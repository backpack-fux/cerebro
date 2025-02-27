import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFTeamNode, RFTeamNodeData, CreateTeamNodeParams, UpdateTeamNodeParams, RFTeamEdge, Neo4jTeamNodeData } from '@/services/graph/team/team.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge, reactFlowToNeo4j, neo4jToReactFlow } from '@/services/graph/team/team.transform';

export class TeamService {
  constructor(private storage: IGraphStorage<RFTeamNodeData>) {}

  async create(params: CreateTeamNodeParams): Promise<RFTeamNode> {
    console.log('[TeamService] Creating team node:', params);
    
    try {
      // Create a complete node with default values
      const node: RFTeamNode = {
        id: crypto.randomUUID(),
        type: 'team',
        position: params.position,
        data: {
          title: params.title,
          description: params.description || '',
          name: params.title, // Default name to title
          season: params.season,
          roster: params.roster || [], // Initialize with empty roster if not provided
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      
      // Transform the node to Neo4j format with stringified complex objects
      const neo4jData = reactFlowToNeo4j(node);
      console.log('[TeamService] Transformed node data for Neo4j:', neo4jData);
      
      // Create the node in Neo4j - use type assertion to handle the type mismatch
      const result = await this.storage.createNode('team', neo4jData as unknown as RFTeamNodeData);
      
      // Transform back to React Flow format - use type assertion to handle the type mismatch
      const rfNode = neo4jToReactFlow(result as unknown as Neo4jTeamNodeData);
      console.log('[TeamService] Created team node:', rfNode);
      
      return rfNode;
    } catch (error) {
      console.error('[TeamService] Error creating team node:', error);
      throw error;
    }
  }

  async update(params: UpdateTeamNodeParams): Promise<RFTeamNode> {
    console.log('[TeamService] Updating team node:', params);
    
    try {
      const { id, ...updateData } = params;
      
      // Get the current node
      const currentNode = await this.storage.getNode(id) as RFTeamNode;
      if (!currentNode) {
        throw new Error(`Team node with ID ${id} not found`);
      }
      
      // Create a merged node with the updates
      const updatedNode: RFTeamNode = {
        ...currentNode,
        data: {
          ...currentNode.data,
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      };
      
      // Transform to Neo4j format
      const neo4jData = reactFlowToNeo4j(updatedNode);
      console.log('[TeamService] Transformed update data for Neo4j:', neo4jData);
      
      // Remove the id from the properties as it's used for matching
      const { id: _, ...neo4jUpdateData } = neo4jData;
      
      // Update the node in Neo4j - use type assertion to handle the type mismatch
      const result = await this.storage.updateNode(id, neo4jUpdateData as unknown as Partial<RFTeamNodeData>);
      
      // Transform back to React Flow format - use type assertion to handle the type mismatch
      const rfNode = neo4jToReactFlow(result as unknown as Neo4jTeamNodeData);
      console.log('[TeamService] Updated team node:', rfNode);
      
      return rfNode;
    } catch (error) {
      console.error('[TeamService] Error updating team node:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    return this.storage.deleteNode(id);
  }

  // Edge operations
  async createEdge(edge: RFTeamEdge): Promise<RFTeamEdge> {
    const graphEdge = reactFlowToNeo4jEdge(edge);
    const result = await this.storage.createEdge(graphEdge);
    return neo4jToReactFlowEdge(result);
  }

  async getEdges(nodeId: string, type?: string): Promise<RFTeamEdge[]> {
    const edges = await this.storage.getEdges(nodeId, type);
    return edges.map(edge => neo4jToReactFlowEdge(edge));
  }

  async getEdge(edgeId: string): Promise<RFTeamEdge | null> {
    const edge = await this.storage.getEdge(edgeId);
    return edge ? neo4jToReactFlowEdge(edge) : null;
  }

  async updateEdge(edgeId: string, properties: Partial<RFTeamEdge['data']>): Promise<RFTeamEdge> {
    const result = await this.storage.updateEdge(edgeId, properties);
    return neo4jToReactFlowEdge(result);
  }

  async deleteEdge(edgeId: string): Promise<void> {
    return this.storage.deleteEdge(edgeId);
  }

  // Team-specific operations
  async addTeamMember(teamId: string, memberId: string, allocation: number = 100, role: string = 'member'): Promise<RFTeamEdge> {
    // Create an edge between team and team member
    const edge: RFTeamEdge = {
      id: `edge-${crypto.randomUUID()}`,
      source: teamId,
      target: memberId,
      type: 'TEAM_MEMBER',
      data: {
        label: 'Team Member',
        allocation: allocation,
      },
    };
    
    // Also update the team's roster
    const team = await this.storage.getNode(teamId) as RFTeamNode;
    if (team) {
      const roster = [...(team.data.roster || [])];
      // Check if member already exists in roster
      const existingMemberIndex = roster.findIndex(m => m.memberId === memberId);
      
      if (existingMemberIndex >= 0) {
        // Update existing member
        roster[existingMemberIndex] = {
          ...roster[existingMemberIndex],
          allocation,
          role,
        };
      } else {
        // Add new member
        roster.push({
          memberId,
          allocation,
          role,
          startDate: new Date().toISOString().split('T')[0], // Today's date
        });
      }
      
      // Update the team node
      await this.update({
        id: teamId,
        roster,
      });
    }
    
    return this.createEdge(edge);
  }

  async removeTeamMember(teamId: string, memberId: string): Promise<void> {
    // Find the edge between team and member
    const edges = await this.getEdges(teamId, 'TEAM_MEMBER');
    const edge = edges.find(e => e.target === memberId);
    
    if (edge) {
      await this.deleteEdge(edge.id);
    }
    
    // Also update the team's roster
    const team = await this.storage.getNode(teamId) as RFTeamNode;
    if (team) {
      const roster = (team.data.roster || []).filter(m => m.memberId !== memberId);
      
      // Update the team node
      await this.update({
        id: teamId,
        roster,
      });
    }
  }

  async updateTeamMemberAllocation(teamId: string, memberId: string, allocation: number): Promise<void> {
    // Find the edge between team and member
    const edges = await this.getEdges(teamId, 'TEAM_MEMBER');
    const edge = edges.find(e => e.target === memberId);
    
    if (edge) {
      // Update the edge allocation
      await this.updateEdge(edge.id, { allocation });
    }
    
    // Also update the team's roster
    const team = await this.storage.getNode(teamId) as RFTeamNode;
    if (team) {
      const roster = [...(team.data.roster || [])];
      const memberIndex = roster.findIndex(m => m.memberId === memberId);
      
      if (memberIndex >= 0) {
        roster[memberIndex] = {
          ...roster[memberIndex],
          allocation,
        };
        
        // Update the team node
        await this.update({
          id: teamId,
          roster,
        });
      }
    }
  }
} 