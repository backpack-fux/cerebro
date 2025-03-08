import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFFeatureNode, RFFeatureNodeData, CreateFeatureNodeParams, UpdateFeatureNodeParams, RFFeatureEdge, MemberAllocation, TeamAllocation, Neo4jFeatureNodeData, BuildType, TimeUnit } from '@/services/graph/feature/feature.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge, reactFlowToNeo4j, neo4jToReactFlow } from '@/services/graph/feature/feature.transform';

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
    console.log(`[FeatureService] Adding team ${teamId} to feature ${featureId} with ${requestedHours} hours`);
    try {
      // Create an edge between feature and team
      const edge: RFFeatureEdge = {
        id: `edge-${crypto.randomUUID()}`,
        source: featureId,
        target: teamId,
        type: 'FEATURE_TEAM',
        data: {
          label: 'Feature Team',
          allocation: requestedHours,
        },
      };
      
      // Also update the feature's team allocations
      const feature = await this.storage.getNode(featureId);
      if (!feature) {
        throw new Error(`Feature with ID ${featureId} not found`);
      }
      
      const featureNode = feature as RFFeatureNode;
      
      // Parse teamAllocations if it's a string
      let teamAllocations: Array<{
        teamId: string;
        requestedHours: number;
        allocatedMembers: Array<{ memberId: string; hours: number }>;
      }> = [];
      if (typeof featureNode.data.teamAllocations === 'string') {
        try {
          teamAllocations = JSON.parse(featureNode.data.teamAllocations);
        } catch (e) {
          console.error('[FeatureService] Error parsing teamAllocations:', e);
          teamAllocations = [];
        }
      } else if (Array.isArray(featureNode.data.teamAllocations)) {
        teamAllocations = [...featureNode.data.teamAllocations];
      }
      
      console.log(`[FeatureService] Current teamAllocations:`, teamAllocations);
      
      // Check if team already exists in allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      
      if (existingTeamIndex >= 0) {
        // Update existing team
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          requestedHours,
        };
      } else {
        // Add new team
        teamAllocations.push({
          teamId,
          requestedHours,
          allocatedMembers: [],
        });
      }
      
      console.log(`[FeatureService] Updated teamAllocations:`, teamAllocations);
      
      // Update the feature node
      const updateResult = await this.update({
        id: featureId,
        teamAllocations,
      });
      
      console.log(`[FeatureService] Feature node updated:`, updateResult);
      
      // Create the edge
      const createdEdge = await this.createEdge(edge);
      console.log(`[FeatureService] Edge created:`, createdEdge);
      
      return createdEdge;
    } catch (error) {
      console.error(`[FeatureService] Error adding team ${teamId} to feature ${featureId}:`, error);
      throw error;
    }
  }

  async removeTeam(featureId: string, teamId: string): Promise<void> {
    console.log(`[FeatureService] Removing team ${teamId} from feature ${featureId}`);
    try {
      // Find the edge between feature and team
      const edges = await this.getEdges(featureId, 'FEATURE_TEAM');
      const edge = edges.find(e => e.target === teamId);
      
      if (edge) {
        await this.deleteEdge(edge.id);
        console.log(`[FeatureService] Deleted edge ${edge.id} between feature ${featureId} and team ${teamId}`);
      } else {
        console.log(`[FeatureService] No edge found between feature ${featureId} and team ${teamId}`);
      }
      
      // Also update the feature's team allocations
      const feature = await this.storage.getNode(featureId);
      if (!feature) {
        throw new Error(`Feature with ID ${featureId} not found`);
      }
      
      const featureNode = feature as RFFeatureNode;
      
      // Parse teamAllocations if it's a string
      let teamAllocations: Array<{
        teamId: string;
        requestedHours: number;
        allocatedMembers: Array<{ memberId: string; hours: number }>;
      }> = [];
      
      if (typeof featureNode.data.teamAllocations === 'string') {
        try {
          teamAllocations = JSON.parse(featureNode.data.teamAllocations);
        } catch (e) {
          console.error('[FeatureService] Error parsing teamAllocations:', e);
          teamAllocations = [];
        }
      } else if (Array.isArray(featureNode.data.teamAllocations)) {
        teamAllocations = [...featureNode.data.teamAllocations];
      }
      
      console.log(`[FeatureService] Current teamAllocations:`, teamAllocations);
      
      // Filter out the team to remove
      const updatedTeamAllocations = teamAllocations.filter(t => t.teamId !== teamId);
      
      console.log(`[FeatureService] Updated teamAllocations:`, updatedTeamAllocations);
      
      // Update the feature node
      const updateResult = await this.update({
        id: featureId,
        teamAllocations: updatedTeamAllocations,
      });
      
      console.log(`[FeatureService] Feature node updated:`, updateResult);
    } catch (error) {
      console.error(`[FeatureService] Error removing team ${teamId} from feature ${featureId}:`, error);
      throw error;
    }
  }

  async updateTeamAllocation(featureId: string, teamId: string, requestedHours: number, allocatedMembers: { memberId: string; name?: string; hours: number; hoursPerDay?: number }[] = []): Promise<void> {
    console.log(`[FeatureService] Updating allocation for team ${teamId} in feature ${featureId}`);
    console.log(`[FeatureService] Allocated members:`, JSON.stringify(allocatedMembers, null, 2));
    
    try {
      // Find the edge between feature and team
      const edges = await this.getEdges(featureId, 'FEATURE_TEAM');
      const edge = edges.find(e => e.target === teamId);
      
      if (edge) {
        // Update the edge allocation
        await this.updateEdge(edge.id, { allocation: requestedHours });
      }
      
      // Also update the feature's team allocations
      const feature = await this.storage.getNode(featureId);
      if (!feature) {
        throw new Error(`Feature with ID ${featureId} not found`);
      }
      
      const featureNode = feature as RFFeatureNode;
      const teamAllocations = [...(featureNode.data.teamAllocations || [])];
      const teamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      
      if (teamIndex >= 0) {
        teamAllocations[teamIndex] = {
          ...teamAllocations[teamIndex],
          requestedHours,
          allocatedMembers,
        };
      } else {
        // Add new team allocation if it doesn't exist
        teamAllocations.push({
          teamId,
          requestedHours,
          allocatedMembers,
        });
      }
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations,
      });
    } catch (error) {
      console.error(`[FeatureService] Error updating allocation for team ${teamId} in feature ${featureId}:`, error);
      throw error;
    }
  }
} 