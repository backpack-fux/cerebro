import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFFeatureNode, RFFeatureNodeData, CreateFeatureNodeParams, UpdateFeatureNodeParams, RFFeatureEdge, TeamAllocation } from '@/services/graph/feature/feature.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge, reactFlowToNeo4j } from '@/services/graph/feature/feature.transform';
import { connectFeatureToTeam, disconnectFeatureFromTeam, updateFeatureResourceAllocation, getFeatureMemberAvailableHours, ResourceUpdateData } from './feature-resource-integration';

export class FeatureService {
  constructor(private storage: IGraphStorage<RFFeatureNodeData>) {}

  async create(params: CreateFeatureNodeParams): Promise<RFFeatureNode> {
    console.log('[FeatureService] Creating feature node:', params);
    
    try {
      // Create a basic node with the required properties
      const node: RFFeatureNode = {
        id: crypto.randomUUID(),
        type: 'feature',
        position: params.position,
        data: {
          title: params.title,
          description: params.description || '',
          name: params.title, // Default name to title
          buildType: params.buildType,
          duration: params.duration,
          timeUnit: params.timeUnit,
          status: params.status || 'planning', // Default status
          teamMembers: [],
          memberAllocations: [],
          teamAllocations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      
      // Use the transform function to convert to Neo4j format for storage
      const neo4jData = reactFlowToNeo4j(node);
      
      // Create the node in Neo4j
      const result = await this.storage.createNode('feature', neo4jData as unknown as RFFeatureNodeData);
      
      console.log('[FeatureService] Created feature node:', result);
      return result as RFFeatureNode;
    } catch (error) {
      console.error('[FeatureService] Error creating feature node:', error);
      throw error;
    }
  }

  async update(params: UpdateFeatureNodeParams): Promise<RFFeatureNode> {
    console.log('[FeatureService] Updating feature node:', params);
    
    try {
      const { id, ...updateData } = params;
      
      // Get the current node
      const currentNode = await this.storage.getNode(id);
      if (!currentNode) {
        throw new Error(`Feature node with ID ${id} not found`);
      }
      
      // Create a merged node with the updates
      const updatedNode: RFFeatureNode = {
        ...currentNode as RFFeatureNode,
        data: {
          ...(currentNode as RFFeatureNode).data,
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      };
      
      // If position is provided, update it
      if (params.position) {
        updatedNode.position = params.position;
      }
      
      // Transform to Neo4j format for storage
      const neo4jData = reactFlowToNeo4j(updatedNode);
      
      // Update the node in Neo4j
      const result = await this.storage.updateNode(id, neo4jData as unknown as Partial<RFFeatureNodeData>);
      
      console.log('[FeatureService] Updated feature node:', result);
      return result as RFFeatureNode;
    } catch (error) {
      console.error('[FeatureService] Error updating feature node:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('[FeatureService] Deleting feature node:', id);
    try {
      // Get the feature node to find its team connections
      const featureNode = await this.storage.getNode(id) as RFFeatureNode;
      if (featureNode) {
        // Get team allocations
        let teamAllocations: TeamAllocation[] = [];
        try {
          if (typeof featureNode.data.teamAllocations === 'string') {
            teamAllocations = JSON.parse(featureNode.data.teamAllocations);
          } else if (Array.isArray(featureNode.data.teamAllocations)) {
            teamAllocations = featureNode.data.teamAllocations;
          }
        } catch (error) {
          console.error('[FeatureService] Error parsing team allocations:', error);
        }
        
        // Disconnect from all teams
        for (const allocation of teamAllocations) {
          console.log(`[FeatureService] Cleaning up resources for team ${allocation.teamId} in feature ${id}`);
          disconnectFeatureFromTeam(id, allocation.teamId);
        }
      }
      
      // Delete the node from storage
      await this.storage.deleteNode(id);
      console.log('[FeatureService] Deleted feature node successfully');
    } catch (error) {
      console.error('[FeatureService] Error deleting feature node:', error);
      throw error;
    }
  }

  /**
   * Get a feature node by ID
   * @param id The feature ID
   * @returns The feature node or null if not found
   */
  async getNode(id: string): Promise<RFFeatureNode | null> {
    console.log('[FeatureService] Getting feature node:', id);
    try {
      const node = await this.storage.getNode(id);
      if (!node) {
        console.log(`[FeatureService] No feature node found with ID: ${id}`);
        return null;
      }
      console.log('[FeatureService] Retrieved feature node:', node);
      return node as RFFeatureNode;
    } catch (error) {
      console.error('[FeatureService] Error getting feature node:', error);
      throw error;
    }
  }

  // Edge operations
  async createEdge(edge: RFFeatureEdge): Promise<RFFeatureEdge> {
    console.log('[FeatureService] Creating feature edge:', edge);
    try {
      const graphEdge = reactFlowToNeo4jEdge(edge);
      const result = await this.storage.createEdge(graphEdge);
      const rfEdge = neo4jToReactFlowEdge(result);
      console.log('[FeatureService] Created feature edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[FeatureService] Error creating feature edge:', error);
      throw error;
    }
  }

  async getEdges(nodeId: string, type?: string): Promise<RFFeatureEdge[]> {
    console.log('[FeatureService] Getting edges for feature node:', nodeId);
    try {
      const edges = await this.storage.getEdges(nodeId, type);
      const rfEdges = edges.map(edge => neo4jToReactFlowEdge(edge));
      console.log(`[FeatureService] Retrieved ${rfEdges.length} edges for feature node: ${nodeId}`);
      return rfEdges;
    } catch (error) {
      console.error('[FeatureService] Error getting edges for feature node:', error);
      throw error;
    }
  }

  async getEdge(edgeId: string): Promise<RFFeatureEdge | null> {
    console.log('[FeatureService] Getting feature edge:', edgeId);
    try {
      const edge = await this.storage.getEdge(edgeId);
      if (!edge) {
        console.log(`[FeatureService] No feature edge found with ID: ${edgeId}`);
        return null;
      }
      const rfEdge = neo4jToReactFlowEdge(edge);
      console.log('[FeatureService] Retrieved feature edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[FeatureService] Error getting feature edge:', error);
      throw error;
    }
  }

  async updateEdge(edgeId: string, properties: Partial<RFFeatureEdge['data']>): Promise<RFFeatureEdge> {
    console.log('[FeatureService] Updating feature edge:', { edgeId, properties });
    try {
      const result = await this.storage.updateEdge(edgeId, properties);
      const rfEdge = neo4jToReactFlowEdge(result);
      console.log('[FeatureService] Updated feature edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[FeatureService] Error updating feature edge:', error);
      throw error;
    }
  }

  async deleteEdge(edgeId: string): Promise<void> {
    console.log('[FeatureService] Deleting feature edge:', edgeId);
    try {
      await this.storage.deleteEdge(edgeId);
      console.log('[FeatureService] Deleted feature edge successfully');
    } catch (error) {
      console.error('[FeatureService] Error deleting feature edge:', error);
      throw error;
    }
  }

  // Feature-specific operations
  async addTeamMember(featureId: string, memberId: string, timePercentage: number = 0): Promise<RFFeatureEdge> {
    console.log(`[FeatureService] Adding team member ${memberId} to feature ${featureId}`);
    try {
      // Create an edge between feature and team member
      const edge: RFFeatureEdge = {
        id: `edge-${crypto.randomUUID()}`,
        source: featureId,
        target: memberId,
        type: 'FEATURE_MEMBER',
        data: {
          label: 'Feature Member',
          allocation: timePercentage,
        },
      };
      
      // Also update the feature's member allocations
      const feature = await this.storage.getNode(featureId);
      if (!feature) {
        throw new Error(`Feature with ID ${featureId} not found`);
      }
      
      const featureNode = feature as RFFeatureNode;
      const memberAllocations = [...(featureNode.data.memberAllocations || [])];
      // Check if member already exists in allocations
      const existingMemberIndex = memberAllocations.findIndex(m => m.memberId === memberId);
      
      if (existingMemberIndex >= 0) {
        // Update existing member
        memberAllocations[existingMemberIndex] = {
          ...memberAllocations[existingMemberIndex],
          timePercentage,
        };
      } else {
        // Add new member
        memberAllocations.push({
          memberId,
          timePercentage,
        });
      }
      
      // Update the feature node
      await this.update({
        id: featureId,
        memberAllocations,
        teamMembers: [...(featureNode.data.teamMembers || []), memberId],
      });
      
      return this.createEdge(edge);
    } catch (error) {
      console.error(`[FeatureService] Error adding team member ${memberId} to feature ${featureId}:`, error);
      throw error;
    }
  }

  async removeTeamMember(featureId: string, memberId: string): Promise<void> {
    console.log(`[FeatureService] Removing team member ${memberId} from feature ${featureId}`);
    try {
      // Find the edge between feature and member
      const edges = await this.getEdges(featureId, 'FEATURE_MEMBER');
      const edge = edges.find(e => e.target === memberId);
      
      if (edge) {
        await this.deleteEdge(edge.id);
      }
      
      // Also update the feature's member allocations
      const feature = await this.storage.getNode(featureId);
      if (!feature) {
        throw new Error(`Feature with ID ${featureId} not found`);
      }
      
      const featureNode = feature as RFFeatureNode;
      const memberAllocations = (featureNode.data.memberAllocations || []).filter(m => m.memberId !== memberId);
      const teamMembers = (featureNode.data.teamMembers || []).filter(id => id !== memberId);
      
      // Update the feature node
      await this.update({
        id: featureId,
        memberAllocations,
        teamMembers,
      });
    } catch (error) {
      console.error(`[FeatureService] Error removing team member ${memberId} from feature ${featureId}:`, error);
      throw error;
    }
  }

  async addTeam(featureId: string, teamId: string, requestedHours: number = 0): Promise<RFFeatureEdge> {
    console.log(`[FeatureService] Adding team ${teamId} to feature ${featureId}`);
    
    try {
      // Get the feature node
      const featureNode = await this.storage.getNode(featureId) as RFFeatureNode;
      if (!featureNode) {
        throw new Error(`Feature node with ID ${featureId} not found`);
      }
      
      // Get the team node
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team node with ID ${teamId} not found`);
      }
      
      // Create the edge
      const edge: RFFeatureEdge = {
        id: crypto.randomUUID(),
        source: featureId,
        target: teamId,
        type: 'feature-team',
        data: {
          requestedHours,
          allocatedMembers: [],
        },
      };
      
      // Create the edge in Neo4j
      const result = await this.createEdge(edge);
      
      // Update the feature node with the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof featureNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(featureNode.data.teamAllocations);
        } else if (Array.isArray(featureNode.data.teamAllocations)) {
          teamAllocations = featureNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Check if the team is already in the allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      if (existingTeamIndex >= 0) {
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          requestedHours,
        };
      } else {
        // Get team name from the team node
        const teamName = teamNode.data.title || teamNode.data.name || 'Unknown Team';
        
        // Add the team to the allocations
        teamAllocations.push({
          teamId,
          teamName,
          requestedHours,
          allocatedMembers: [],
          teamBandwidth: 0,
          availableBandwidth: 0,
        });
      }
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations: teamAllocations,
      });
      
      // Connect the feature to the team's resources
      connectFeatureToTeam(
        featureNode,
        teamId,
        (data) => {
          // Handle resource updates
          this.handleTeamResourceUpdate(featureId, teamId, data);
        }
      );
      
      return result;
    } catch (error) {
      console.error(`[FeatureService] Error adding team ${teamId} to feature ${featureId}:`, error);
      throw error;
    }
  }

  async removeTeam(featureId: string, teamId: string): Promise<void> {
    console.log(`[FeatureService] Removing team ${teamId} from feature ${featureId}`);
    
    try {
      // Get the feature node
      const featureNode = await this.storage.getNode(featureId) as RFFeatureNode;
      if (!featureNode) {
        throw new Error(`Feature node with ID ${featureId} not found`);
      }
      
      // Get the edges connecting the feature to the team
      const edges = await this.getEdges(featureId);
      const teamEdge = edges.find(edge => edge.target === teamId && edge.type === 'feature-team');
      
      if (teamEdge) {
        // Delete the edge
        await this.deleteEdge(teamEdge.id);
      }
      
      // Update the feature node to remove the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof featureNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(featureNode.data.teamAllocations);
        } else if (Array.isArray(featureNode.data.teamAllocations)) {
          teamAllocations = featureNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Remove the team from the allocations
      teamAllocations = teamAllocations.filter(t => t.teamId !== teamId);
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations: teamAllocations,
      });
      
      // Disconnect the feature from the team's resources
      disconnectFeatureFromTeam(featureId, teamId);
      
    } catch (error) {
      console.error(`[FeatureService] Error removing team ${teamId} from feature ${featureId}:`, error);
      throw error;
    }
  }

  async updateTeamAllocation(
    featureId: string, 
    teamId: string, 
    requestedHours: number, 
    allocatedMembers: { memberId: string; name?: string; hours: number; hoursPerDay?: number }[] = []
  ): Promise<void> {
    console.log(`[FeatureService] Updating team allocation for team ${teamId} in feature ${featureId}`);
    
    try {
      // Get the feature node
      const featureNode = await this.storage.getNode(featureId) as RFFeatureNode;
      if (!featureNode) {
        throw new Error(`Feature node with ID ${featureId} not found`);
      }
      
      // Get the team node
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team node with ID ${teamId} not found`);
      }
      
      // Update the feature node with the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof featureNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(featureNode.data.teamAllocations);
        } else if (Array.isArray(featureNode.data.teamAllocations)) {
          teamAllocations = featureNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Format the allocated members to ensure they have names
      const formattedAllocatedMembers = allocatedMembers.map(member => {
        return {
          memberId: member.memberId,
          name: member.name || 'Unknown Member',
          hours: member.hours,
        };
      });
      
      // Check if the team is already in the allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      if (existingTeamIndex >= 0) {
        // Update the existing allocation
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          requestedHours,
          allocatedMembers: formattedAllocatedMembers,
        };
      } else {
        // Get team name from the team node
        const teamName = teamNode.data.title || teamNode.data.name || 'Unknown Team';
        
        // Add the team to the allocations
        teamAllocations.push({
          teamId,
          teamName,
          requestedHours,
          allocatedMembers: formattedAllocatedMembers,
          teamBandwidth: 0,
          availableBandwidth: 0,
        });
      }
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations: teamAllocations,
      });
      
      // Get the project duration
      const projectDurationDays = featureNode.data.duration || 5;
      
      // Update resource allocation in the observer
      updateFeatureResourceAllocation(
        featureId,
        teamId,
        formattedAllocatedMembers,
        projectDurationDays
      );
      
    } catch (error) {
      console.error(`[FeatureService] Error updating team allocation for team ${teamId} in feature ${featureId}:`, error);
      throw error;
    }
  }
  
  /**
   * Handle team resource updates from the observer
   */
  private async handleTeamResourceUpdate(featureId: string, teamId: string, data: ResourceUpdateData) {
    console.log(`[FeatureService] Received resource update for feature ${featureId} from team ${teamId}`);
    
    try {
      // Get the feature node
      const featureNode = await this.storage.getNode(featureId) as RFFeatureNode;
      if (!featureNode) {
        console.warn(`Feature node with ID ${featureId} not found`);
        return;
      }
      
      // Update the feature node with the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof featureNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(featureNode.data.teamAllocations);
        } else if (Array.isArray(featureNode.data.teamAllocations)) {
          teamAllocations = featureNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Check if the team is already in the allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      if (existingTeamIndex >= 0) {
        // Update the existing allocation with bandwidth information
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          teamBandwidth: data.teamBandwidth || 0,
          availableBandwidth: data.availableBandwidth || 0,
        };
        
        // Update member allocations if available
        if (data.memberResources) {
          const allocatedMembers = teamAllocations[existingTeamIndex].allocatedMembers || [];
          
          // Update each member's available hours
          for (let i = 0; i < allocatedMembers.length; i++) {
            const member = allocatedMembers[i];
            const memberResource = data.memberResources?.find(m => m.memberId === member.memberId);
            
            if (memberResource) {
              // Calculate available hours for this member
              const projectDurationDays = featureNode.data.duration || 5;
              const availableHours = getFeatureMemberAvailableHours(
                featureId,
                teamId,
                member.memberId,
                // Ensure required properties are present for TeamMemberData
                {
                  hoursPerDay: memberResource.hoursPerDay || 8,
                  daysPerWeek: memberResource.daysPerWeek || 5,
                  weeklyCapacity: memberResource.weeklyCapacity,
                  allocation: memberResource.allocation
                },
                projectDurationDays
              );
              
              // Update the member allocation
              allocatedMembers[i] = {
                ...member,
                availableHours,
              };
            }
          }
          
          // Update the team allocation with the updated members
          teamAllocations[existingTeamIndex].allocatedMembers = allocatedMembers;
        }
      }
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations: teamAllocations,
      });
      
    } catch (error) {
      console.error(`[FeatureService] Error handling resource update for feature ${featureId} from team ${teamId}:`, error);
    }
  }

  // Add getById method to retrieve a node by ID
  async getById(id: string): Promise<RFFeatureNode | null> {
    const node = await this.storage.getNode(id);
    if (!node) return null;
    return node as RFFeatureNode;
  }
} 