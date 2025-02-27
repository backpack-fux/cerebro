import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFFeatureNode, RFFeatureNodeData, CreateFeatureNodeParams, UpdateFeatureNodeParams, RFFeatureEdge, MemberAllocation, TeamAllocation, Neo4jFeatureNodeData, BuildType, TimeUnit } from '@/services/graph/feature/feature.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge, reactFlowToNeo4j, neo4jToReactFlow } from '@/services/graph/feature/feature.transform';

export class FeatureService {
  constructor(private storage: IGraphStorage<RFFeatureNodeData>) {}

  async create(params: CreateFeatureNodeParams): Promise<RFFeatureNode> {
    console.log('[FeatureService] Creating feature node:', params);
    
    // Create a basic node with the required properties
    const nodeData: RFFeatureNodeData = {
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
    };
    
    // Extract position values
    const positionX = params.position.x;
    const positionY = params.position.y;
    
    // Create the node directly with the storage service
    // The storage service will generate an ID
    const createdNode = await this.storage.createNode('feature', {
      ...nodeData,
      positionX,
      positionY,
    } as any);
    
    console.log('[FeatureService] Created feature node:', createdNode);
    
    // Return the created node
    return createdNode as RFFeatureNode;
  }

  async update(params: UpdateFeatureNodeParams): Promise<RFFeatureNode> {
    console.log('[FeatureService] Updating feature node:', params);
    
    const { id, ...updateData } = params;
    
    // Get the current node to transform it properly
    const currentNode = await this.storage.getNode(id);
    if (!currentNode) {
      throw new Error(`Feature node with ID ${id} not found`);
    }
    
    // Extract position values if provided
    let positionX = currentNode.position.x;
    let positionY = currentNode.position.y;
    
    if (updateData.position) {
      positionX = updateData.position.x;
      positionY = updateData.position.y;
      delete updateData.position; // Remove position from updateData
    }
    
    // Create a copy of updateData to modify
    const updatedProperties: any = { ...updateData };
    
    // Handle complex objects
    if (updatedProperties.memberAllocations) {
      updatedProperties.memberAllocations = JSON.stringify(updatedProperties.memberAllocations);
    }
    
    if (updatedProperties.teamAllocations) {
      updatedProperties.teamAllocations = JSON.stringify(updatedProperties.teamAllocations);
    }
    
    if (updatedProperties.teamMembers) {
      updatedProperties.teamMembers = JSON.stringify(updatedProperties.teamMembers);
    }
    
    // Update the node in Neo4j
    const updatedNode = await this.storage.updateNode(id, {
      ...updatedProperties,
      positionX,
      positionY,
    } as any);
    
    console.log('[FeatureService] Updated feature node:', updatedNode);
    
    // Return the updated node
    return updatedNode as RFFeatureNode;
  }

  async delete(id: string): Promise<void> {
    return this.storage.deleteNode(id);
  }

  // Edge operations
  async createEdge(edge: RFFeatureEdge): Promise<RFFeatureEdge> {
    const graphEdge = reactFlowToNeo4jEdge(edge);
    const result = await this.storage.createEdge(graphEdge);
    return neo4jToReactFlowEdge(result);
  }

  async getEdges(nodeId: string, type?: string): Promise<RFFeatureEdge[]> {
    const edges = await this.storage.getEdges(nodeId, type);
    return edges.map(edge => neo4jToReactFlowEdge(edge));
  }

  async getEdge(edgeId: string): Promise<RFFeatureEdge | null> {
    const edge = await this.storage.getEdge(edgeId);
    return edge ? neo4jToReactFlowEdge(edge) : null;
  }

  async updateEdge(edgeId: string, properties: Partial<RFFeatureEdge['data']>): Promise<RFFeatureEdge> {
    const result = await this.storage.updateEdge(edgeId, properties);
    return neo4jToReactFlowEdge(result);
  }

  async deleteEdge(edgeId: string): Promise<void> {
    return this.storage.deleteEdge(edgeId);
  }

  // Feature-specific operations
  async addTeamMember(featureId: string, memberId: string, timePercentage: number = 0): Promise<RFFeatureEdge> {
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
    const feature = await this.storage.getNode(featureId) as RFFeatureNode;
    if (feature) {
      // Transform the node to properly parse JSON strings
      const transformedFeature = neo4jToReactFlow(feature.data as unknown as Neo4jFeatureNodeData);
      
      const memberAllocations = [...(transformedFeature.data.memberAllocations || [])];
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
        teamMembers: [...(transformedFeature.data.teamMembers || []), memberId],
      });
    }
    
    return this.createEdge(edge);
  }

  async removeTeamMember(featureId: string, memberId: string): Promise<void> {
    // Find the edge between feature and member
    const edges = await this.getEdges(featureId, 'FEATURE_MEMBER');
    const edge = edges.find(e => e.target === memberId);
    
    if (edge) {
      await this.deleteEdge(edge.id);
    }
    
    // Also update the feature's member allocations
    const feature = await this.storage.getNode(featureId) as RFFeatureNode;
    if (feature) {
      // Transform the node to properly parse JSON strings
      const transformedFeature = neo4jToReactFlow(feature.data as unknown as Neo4jFeatureNodeData);
      
      const memberAllocations = (transformedFeature.data.memberAllocations || []).filter(m => m.memberId !== memberId);
      const teamMembers = (transformedFeature.data.teamMembers || []).filter(id => id !== memberId);
      
      // Update the feature node
      await this.update({
        id: featureId,
        memberAllocations,
        teamMembers,
      });
    }
  }

  async addTeam(featureId: string, teamId: string, requestedHours: number = 0): Promise<RFFeatureEdge> {
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
    const feature = await this.storage.getNode(featureId) as RFFeatureNode;
    if (feature) {
      // Transform the node to properly parse JSON strings
      const transformedFeature = neo4jToReactFlow(feature.data as unknown as Neo4jFeatureNodeData);
      
      const teamAllocations = [...(transformedFeature.data.teamAllocations || [])];
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
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations,
      });
    }
    
    return this.createEdge(edge);
  }

  async removeTeam(featureId: string, teamId: string): Promise<void> {
    // Find the edge between feature and team
    const edges = await this.getEdges(featureId, 'FEATURE_TEAM');
    const edge = edges.find(e => e.target === teamId);
    
    if (edge) {
      await this.deleteEdge(edge.id);
    }
    
    // Also update the feature's team allocations
    const feature = await this.storage.getNode(featureId) as RFFeatureNode;
    if (feature) {
      // Transform the node to properly parse JSON strings
      const transformedFeature = neo4jToReactFlow(feature.data as unknown as Neo4jFeatureNodeData);
      
      const teamAllocations = (transformedFeature.data.teamAllocations || []).filter(t => t.teamId !== teamId);
      
      // Update the feature node
      await this.update({
        id: featureId,
        teamAllocations,
      });
    }
  }

  async updateTeamAllocation(featureId: string, teamId: string, requestedHours: number, allocatedMembers: { memberId: string; hours: number }[] = []): Promise<void> {
    // Find the edge between feature and team
    const edges = await this.getEdges(featureId, 'FEATURE_TEAM');
    const edge = edges.find(e => e.target === teamId);
    
    if (edge) {
      // Update the edge allocation
      await this.updateEdge(edge.id, { allocation: requestedHours });
    }
    
    // Also update the feature's team allocations
    const feature = await this.storage.getNode(featureId) as RFFeatureNode;
    if (feature) {
      // Transform the node to properly parse JSON strings
      const transformedFeature = neo4jToReactFlow(feature.data as unknown as Neo4jFeatureNodeData);
      
      const teamAllocations = [...(transformedFeature.data.teamAllocations || [])];
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
    }
  }
} 