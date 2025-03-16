import { nodeObserver, NodeUpdateType, NodeUpdateMetadata } from './node-observer';

/**
 * Types of resource allocation events
 */
export enum ResourceAllocationEventType {
  REQUEST = 'request',       // Work node requests resources
  RELEASE = 'release',       // Work node releases resources
  UPDATE = 'update',         // Team updates available resources
  CONFLICT = 'conflict',     // Resource allocation conflict detected
  SYNC = 'sync'              // Synchronize resource state
}

/**
 * Structure for resource allocation requests
 */
export interface ResourceAllocationRequest {
  workNodeId: string;        // ID of the work node requesting resources
  workNodeType: string;      // Type of work node (feature, option, provider)
  teamId: string;            // ID of the team whose resources are being requested
  memberAllocations: {       // Requested member allocations
    memberId: string;
    name: string;
    hours: number;
  }[];
  requestedHours: number;    // Total requested hours
  projectDurationDays: number; // Duration of the project in days
}

/**
 * Structure for resource allocation responses
 */
export interface ResourceAllocationResponse {
  success: boolean;          // Whether the allocation was successful
  teamId: string;            // ID of the team
  workNodeId: string;        // ID of the work node
  allocatedMembers: {        // Allocated members with hours
    memberId: string;
    name: string;
    hours: number;
    availableHours: number;  // Remaining available hours after allocation
  }[];
  teamBandwidth: number;     // Total team bandwidth percentage
  availableBandwidth: number; // Remaining available bandwidth percentage
  conflictsWith?: string[];  // IDs of work nodes with conflicting allocations
}

/**
 * Team member resource data
 */
interface TeamMemberResource {
  totalHours: number;
  allocatedHours: number;
  allocations: Map<string, number>; // workNodeId -> hours
}

/**
 * Team resource data
 */
interface TeamResource {
  totalBandwidth: number;
  availableBandwidth: number;
  memberAllocations: Map<string, TeamMemberResource>;
}

/**
 * Member allocation data
 */
interface MemberAllocation {
  memberId: string;
  hours: number;
}

/**
 * Team resource observer service
 * Manages resource allocation between teams and work nodes
 */
export class TeamResourceObserver {
  // Track team resource allocations
  private teamResources: Map<string, TeamResource> = new Map();

  constructor() {
    // Initialize with debug mode
    this.setDebugMode(process.env.NODE_ENV !== 'production');
  }

  private debugMode: boolean = false;
  
  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }
  
  /**
   * Log debug information if debug mode is enabled
   */
  private debug(...args: any[]) {
    if (this.debugMode) {
      console.log('[TeamResourceObserver]', ...args);
    }
  }

  /**
   * Initialize team resources when a team node is created or updated
   */
  initializeTeamResources(teamId: string, teamData: any) {
    // Parse team roster to get member data
    let roster: any[] = [];
    try {
      if (typeof teamData.roster === 'string') {
        roster = JSON.parse(teamData.roster);
      } else if (Array.isArray(teamData.roster)) {
        roster = teamData.roster;
      }
    } catch (error) {
      console.error('Error parsing team roster:', error);
      roster = [];
    }

    // Calculate total team bandwidth
    const totalBandwidth = roster.reduce((sum: number, member: any) => sum + (member.allocation || 0), 0);
    
    // Initialize member allocations
    const memberAllocations = new Map<string, TeamMemberResource>();
    roster.forEach(member => {
      memberAllocations.set(member.memberId, {
        totalHours: 0, // Will be calculated when needed
        allocatedHours: 0,
        allocations: new Map<string, number>()
      });
    });

    // Store team resources
    this.teamResources.set(teamId, {
      totalBandwidth,
      availableBandwidth: totalBandwidth,
      memberAllocations
    });

    this.debug(`Initialized resources for team ${teamId}`, {
      totalBandwidth,
      members: roster.length
    });

    // Publish resource update to all subscribers
    this.publishResourceUpdate(teamId);
  }

  /**
   * Subscribe a work node to team resource updates
   */
  subscribeToTeamResources(workNodeId: string, teamId: string) {
    return nodeObserver.subscribe(
      workNodeId,
      teamId,
      this.handleTeamUpdate.bind(this),
      NodeUpdateType.ALLOCATION
    );
  }

  /**
   * Handle updates from team nodes
   */
  private handleTeamUpdate(teamId: string, data: any, metadata: NodeUpdateMetadata) {
    this.debug(`Received update from team ${teamId}`, metadata);
    
    // If team data has changed, reinitialize resources
    if (metadata.updateType === NodeUpdateType.CONTENT) {
      this.initializeTeamResources(teamId, data);
    }
  }

  /**
   * Request resource allocation for a work node
   */
  requestAllocation(request: ResourceAllocationRequest): ResourceAllocationResponse {
    const { workNodeId, teamId, memberAllocations, requestedHours, projectDurationDays } = request;
    
    // Get team resources
    const teamResources = this.teamResources.get(teamId);
    if (!teamResources) {
      this.debug(`Team ${teamId} not found for allocation request`);
      return {
        success: false,
        teamId,
        workNodeId,
        allocatedMembers: [],
        teamBandwidth: 0,
        availableBandwidth: 0
      };
    }

    // Check if allocation is possible
    const allocatedMembers: ResourceAllocationResponse['allocatedMembers'] = [];
    let allocationPossible = true;
    let conflictsWith: string[] = [];

    // Process each member allocation
    memberAllocations.forEach(allocation => {
      const memberResource = teamResources.memberAllocations.get(allocation.memberId);
      if (!memberResource) {
        this.debug(`Member ${allocation.memberId} not found in team ${teamId}`);
        allocationPossible = false;
        return;
      }

      // Calculate available hours for this member
      const currentAllocation = memberResource.allocations.get(workNodeId) || 0;
      const otherAllocations = Array.from(memberResource.allocations.entries())
        .filter(([nodeId]) => nodeId !== workNodeId)
        .reduce((sum: number, [nodeId, hours]) => {
          if (hours > 0) {
            conflictsWith.push(nodeId);
          }
          return sum + hours;
        }, 0);

      const totalAvailableHours = this.calculateMemberTotalHours(memberResource, projectDurationDays);
      const availableHours = totalAvailableHours - otherAllocations;

      // Check if requested hours can be allocated
      if (allocation.hours > availableHours + currentAllocation) {
        this.debug(`Not enough hours available for member ${allocation.memberId}`);
        allocationPossible = false;
      }

      allocatedMembers.push({
        memberId: allocation.memberId,
        name: allocation.name,
        hours: allocation.hours,
        availableHours: availableHours + currentAllocation - allocation.hours
      });
    });

    // If allocation is possible, update team resources
    if (allocationPossible) {
      // Update member allocations
      memberAllocations.forEach(allocation => {
        const memberResource = teamResources.memberAllocations.get(allocation.memberId);
        if (memberResource) {
          const currentAllocation = memberResource.allocations.get(workNodeId) || 0;
          memberResource.allocations.set(workNodeId, allocation.hours);
          memberResource.allocatedHours = memberResource.allocatedHours - currentAllocation + allocation.hours;
        }
      });

      // Recalculate available bandwidth
      const usedBandwidth = Array.from(teamResources.memberAllocations.values())
        .reduce((sum: number, member: TeamMemberResource) => sum + (member.allocatedHours > 0 ? 1 : 0), 0);
      
      teamResources.availableBandwidth = teamResources.totalBandwidth - usedBandwidth;

      this.debug(`Allocation successful for work node ${workNodeId} on team ${teamId}`, {
        requestedHours,
        allocatedMembers
      });

      // Publish resource update to all subscribers
      this.publishResourceUpdate(teamId);

      return {
        success: true,
        teamId,
        workNodeId,
        allocatedMembers,
        teamBandwidth: teamResources.totalBandwidth,
        availableBandwidth: teamResources.availableBandwidth
      };
    } else {
      this.debug(`Allocation failed for work node ${workNodeId} on team ${teamId}`);
      
      return {
        success: false,
        teamId,
        workNodeId,
        allocatedMembers,
        teamBandwidth: teamResources.totalBandwidth,
        availableBandwidth: teamResources.availableBandwidth,
        conflictsWith: [...new Set(conflictsWith)]
      };
    }
  }

  /**
   * Release allocated resources
   */
  releaseAllocation(workNodeId: string, teamId: string) {
    const teamResources = this.teamResources.get(teamId);
    if (!teamResources) {
      this.debug(`Team ${teamId} not found for release request`);
      return false;
    }

    // Remove allocations for this work node
    teamResources.memberAllocations.forEach((memberResource, memberId) => {
      const allocation = memberResource.allocations.get(workNodeId) || 0;
      if (allocation > 0) {
        memberResource.allocations.delete(workNodeId);
        memberResource.allocatedHours -= allocation;
      }
    });

    // Recalculate available bandwidth
    const usedBandwidth = Array.from(teamResources.memberAllocations.values())
      .reduce((sum: number, member: TeamMemberResource) => sum + (member.allocatedHours > 0 ? 1 : 0), 0);
    
    teamResources.availableBandwidth = teamResources.totalBandwidth - usedBandwidth;

    this.debug(`Released allocation for work node ${workNodeId} on team ${teamId}`);

    // Publish resource update to all subscribers
    this.publishResourceUpdate(teamId);

    return true;
  }

  /**
   * Calculate total available hours for a member
   */
  private calculateMemberTotalHours(memberResource: TeamMemberResource, projectDurationDays: number) {
    // This would use the same logic as our shared utility
    // For now, just return a placeholder value
    return 40 * (projectDurationDays / 5); // 40 hours per week
  }

  /**
   * Publish resource update to all subscribers
   */
  private publishResourceUpdate(teamId: string) {
    const teamResources = this.teamResources.get(teamId);
    if (!teamResources) return;

    // Create resource update data
    const updateData = {
      teamId,
      availableBandwidth: teamResources.availableBandwidth,
      totalBandwidth: teamResources.totalBandwidth,
      memberResources: Array.from(teamResources.memberAllocations.entries()).map(([memberId, resource]) => ({
        memberId,
        allocatedHours: resource.allocatedHours,
        totalHours: resource.totalHours,
        allocations: Array.from(resource.allocations.entries()).map(([nodeId, hours]) => ({
          nodeId,
          hours
        }))
      }))
    };

    // Publish update using the node observer
    nodeObserver.publish(teamId, updateData, {
      updateType: NodeUpdateType.ALLOCATION,
      source: 'team-resource-observer',
      affectedFields: ['teamAllocations', 'memberAllocations']
    });
  }

  /**
   * Get current resource allocation state for a team
   */
  getTeamResourceState(teamId: string) {
    return this.teamResources.get(teamId);
  }

  /**
   * Get current allocations for a work node
   */
  getWorkNodeAllocations(workNodeId: string, teamId: string) {
    const teamResources = this.teamResources.get(teamId);
    if (!teamResources) return null;

    const allocations: MemberAllocation[] = [];
    teamResources.memberAllocations.forEach((resource, memberId) => {
      const hours = resource.allocations.get(workNodeId) || 0;
      if (hours > 0) {
        allocations.push({
          memberId,
          hours
        });
      }
    });

    return {
      teamId,
      allocations,
      teamBandwidth: teamResources.totalBandwidth,
      availableBandwidth: teamResources.availableBandwidth
    };
  }

  /**
   * Clean up all resources for a team when it's deleted
   */
  cleanupTeamResources(teamId: string): void {
    this.debug(`Cleaning up resources for team ${teamId}`);
    
    // Get the team resources
    const teamResources = this.teamResources.get(teamId);
    if (!teamResources) {
      this.debug(`Team ${teamId} not found for cleanup`);
      return;
    }
    
    // Get all work nodes that have allocations from this team
    const workNodeIds: string[] = [];
    teamResources.memberAllocations.forEach(memberResource => {
      memberResource.allocations.forEach((_, workNodeId) => {
        if (!workNodeIds.includes(workNodeId)) {
          workNodeIds.push(workNodeId);
        }
      });
    });
    
    // Release allocations for all work nodes
    workNodeIds.forEach(workNodeId => {
      this.releaseAllocation(workNodeId, teamId);
    });
    
    // Remove the team from the resources map
    this.teamResources.delete(teamId);
    
    this.debug(`Cleaned up resources for team ${teamId}`);
  }
}

// Create singleton instance
export const teamResourceObserver = new TeamResourceObserver(); 