/**
 * Integration example for team resource observer
 * 
 * This file demonstrates how to integrate the team resource observer
 * with feature and option nodes to ensure consistent resource allocation.
 */

import { teamResourceObserver, ResourceAllocationRequest } from './team-resource-observer';
import { nodeObserver, NodeUpdateType } from './node-observer';
import { calculateNodeMemberCapacity } from '../../../utils/allocation/node-capacity';
import { AvailableMember } from '../../../utils/types/allocation';

/**
 * Interface for team data
 */
interface TeamData {
  roster?: string | Array<{ memberId: string; allocation?: number }>;
  [key: string]: unknown;
}

/**
 * Interface for resource update data
 */
interface ResourceUpdateData {
  teamId: string;
  teamBandwidth: number;
  availableBandwidth: number;
  memberResources: unknown;
  [key: string]: unknown;
}

/**
 * Initialize team resources when a team node is created or updated
 */
export function initializeTeamResources(teamId: string, teamData: TeamData) {
  // Initialize team resources in the observer
  teamResourceObserver.initializeTeamResources(teamId, teamData);
}

/**
 * Connect a work node to a team and subscribe to resource updates
 */
export function connectWorkNodeToTeam(
  workNodeId: string, 
  workNodeType: string, 
  teamId: string,
  onTeamResourceUpdate: (data: ResourceUpdateData) => void
) {
  // Subscribe to team resource updates
  const unsubscribe = nodeObserver.subscribe(
    workNodeId,
    teamId,
    (publisherId, data, metadata) => {
      if (metadata.updateType === NodeUpdateType.ALLOCATION) {
        // Handle resource allocation updates
        onTeamResourceUpdate(data as ResourceUpdateData);
      }
    },
    NodeUpdateType.ALLOCATION
  );
  
  // Return unsubscribe function for cleanup
  return unsubscribe;
}

/**
 * Request resource allocation for a work node
 */
export function requestResourceAllocation(
  workNodeId: string,
  workNodeType: string,
  teamId: string,
  memberAllocations: Array<{
    memberId: string;
    name: string;
    hours: number;
  }>,
  projectDurationDays: number
) {
  // Create allocation request
  const request: ResourceAllocationRequest = {
    workNodeId,
    workNodeType,
    teamId,
    memberAllocations,
    requestedHours: memberAllocations.reduce((sum, m) => sum + m.hours, 0),
    projectDurationDays
  };
  
  // Request allocation
  return teamResourceObserver.requestAllocation(request);
}

/**
 * Release allocated resources when a work node is disconnected from a team
 */
export function releaseResourceAllocation(workNodeId: string, teamId: string) {
  return teamResourceObserver.releaseAllocation(workNodeId, teamId);
}

/**
 * Get available hours for a team member in a work node context
 */
export function getAvailableHours(
  workNodeId: string,
  teamId: string,
  memberId: string,
  memberData: Partial<AvailableMember>,
  projectDurationDays: number
) {
  // Get team resource state
  const teamResources = teamResourceObserver.getTeamResourceState(teamId);
  if (!teamResources) return 0;
  
  // Get member resource
  const memberResource = teamResources.memberAllocations.get(memberId);
  if (!memberResource) return 0;
  
  // Calculate total available hours for the project duration
  const totalHours = calculateNodeMemberCapacity({
    memberId: memberId,
    name: memberData.name || 'Unknown',
    availableHours: memberData.availableHours || 0,
    hourlyRate: memberData.hourlyRate || 0,
    dailyRate: memberData.dailyRate || memberData.hourlyRate || 0,
    hoursPerDay: memberData.hoursPerDay || 8,
    daysPerWeek: memberData.daysPerWeek || 5,
    weeklyCapacity: memberData.weeklyCapacity || 40,
    allocation: memberData.allocation
  }, projectDurationDays);
  
  // Calculate hours allocated to other work nodes
  const otherAllocations = Array.from(memberResource.allocations.entries())
    .filter(([nodeId]) => nodeId !== workNodeId)
    .reduce((sum, [, hours]) => sum + hours, 0);
  
  // Return available hours
  return Math.max(0, totalHours - otherAllocations);
}

/**
 * Example: Feature node integration
 */
export function integrateWithFeatureNode(
  featureId: string,
  teamId: string,
  featureData: unknown,
  onUpdate: (data: ResourceUpdateData) => void
) {
  // Connect to team and subscribe to resource updates
  const unsubscribe = connectWorkNodeToTeam(
    featureId,
    'feature',
    teamId,
    (data) => {
      // Update feature node with new resource data
      onUpdate({
        teamId: data.teamId as string,
        teamBandwidth: Number(data.totalBandwidth) || 0,
        availableBandwidth: Number(data.availableBandwidth) || 0,
        memberResources: data.memberResources
      });
    }
  );
  
  // Return cleanup function
  return {
    // Request allocation
    allocateResources: (
      memberAllocations: Array<{
        memberId: string;
        name: string;
        hours: number;
      }>,
      projectDurationDays: number
    ) => {
      return requestResourceAllocation(
        featureId,
        'feature',
        teamId,
        memberAllocations,
        projectDurationDays
      );
    },
    
    // Release allocation
    releaseResources: () => {
      return releaseResourceAllocation(featureId, teamId);
    },
    
    // Get available hours for a member
    getAvailableHours: (memberId: string, memberData: Partial<AvailableMember>, projectDurationDays: number) => {
      return getAvailableHours(
        featureId,
        teamId,
        memberId,
        memberData,
        projectDurationDays
      );
    },
    
    // Cleanup
    cleanup: () => {
      releaseResourceAllocation(featureId, teamId);
      unsubscribe();
    }
  };
}

/**
 * Example: Option node integration
 */
export function integrateWithOptionNode(
  optionId: string,
  teamId: string,
  optionData: unknown,
  onUpdate: (data: ResourceUpdateData) => void
) {
  // Connect to team and subscribe to resource updates
  const unsubscribe = connectWorkNodeToTeam(
    optionId,
    'option',
    teamId,
    (data) => {
      // Update option node with new resource data
      onUpdate({
        teamId: data.teamId as string,
        teamBandwidth: Number(data.totalBandwidth) || 0,
        availableBandwidth: Number(data.availableBandwidth) || 0,
        memberResources: data.memberResources
      });
    }
  );
  
  // Return cleanup function
  return {
    // Request allocation
    allocateResources: (
      memberAllocations: Array<{
        memberId: string;
        name: string;
        hours: number;
      }>,
      projectDurationDays: number
    ) => {
      return requestResourceAllocation(
        optionId,
        'option',
        teamId,
        memberAllocations,
        projectDurationDays
      );
    },
    
    // Release allocation
    releaseResources: () => {
      return releaseResourceAllocation(optionId, teamId);
    },
    
    // Get available hours for a member
    getAvailableHours: (memberId: string, memberData: Partial<AvailableMember>, projectDurationDays: number) => {
      return getAvailableHours(
        optionId,
        teamId,
        memberId,
        memberData,
        projectDurationDays
      );
    },
    
    // Cleanup
    cleanup: () => {
      releaseResourceAllocation(optionId, teamId);
      unsubscribe();
    }
  };
}

/**
 * Usage example
 */
/*
// Initialize team resources
initializeTeamResources('team-123', {
  roster: [
    { memberId: 'member-1', name: 'John', allocation: 75 },
    { memberId: 'member-2', name: 'Jane', allocation: 100 }
  ]
});

// Integrate with feature node
const featureResources = integrateWithFeatureNode(
  'feature-456',
  'team-123',
  { duration: 5 },
  (data) => {
    console.log('Feature node received resource update:', data);
  }
);

// Allocate resources
featureResources.allocateResources(
  [
    { memberId: 'member-1', name: 'John', hours: 20 },
    { memberId: 'member-2', name: 'Jane', hours: 15 }
  ],
  5
);

// Get available hours
const availableHours = featureResources.getAvailableHours(
  'member-1',
  { weeklyCapacity: 40, allocation: 75 },
  5
);

// Cleanup when done
featureResources.cleanup();
*/ 