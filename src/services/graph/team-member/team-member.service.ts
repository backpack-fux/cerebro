import {
  CreateTeamMemberNodeParams,
  RFTeamMemberNodeData,
  UpdateTeamMemberNodeParams,
  RFTeamMemberNode,
  RFTeamMemberEdge,
} from "./team-member.types";
import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge } from './team-member.transform';

export class TeamMemberService {
  constructor(private storage: IGraphStorage<RFTeamMemberNodeData>) {}

  /**
   * Create a new team member node in the database
   * @param params The team member data to create
   * @returns The created team member node
   */
  async create(params: CreateTeamMemberNodeParams): Promise<RFTeamMemberNode> {
    console.log('[TeamMemberService] Creating team member node:', params);
    
    try {
      const createdAt = new Date().toISOString();
      const updatedAt = createdAt;
      const title = params.title || 'Untitled Team Member';
      
      const node: RFTeamMemberNode = {
        id: crypto.randomUUID(),
        type: 'teamMember',
        position: params.position,
        data: {
          title: title,
          name: title, // Set name to title as required by ReactFlowNodeBase
          description: params.bio || '', // Use bio as description
          roles: params.roles || [],
          bio: params.bio || '',
          timezone: params.timezone,
          dailyRate: params.dailyRate,
          hoursPerDay: params.hoursPerDay || 8,
          daysPerWeek: params.daysPerWeek || 5,
          weeklyCapacity: (params.hoursPerDay || 8) * (params.daysPerWeek || 5),
          startDate: params.startDate,
          skills: params.skills || [],
          createdAt: createdAt,
          updatedAt: updatedAt,
        },
      };
      
      const result = await this.storage.createNode('teamMember', node.data);
      console.log('[TeamMemberService] Created team member node:', result);
      return result as RFTeamMemberNode;
    } catch (error) {
      console.error('[TeamMemberService] Error creating team member node:', error);
      throw error;
    }
  }

  /**
   * Update an existing team member node in the database
   * @param params The team member data to update
   * @returns The updated team member node
   */
  async update(params: UpdateTeamMemberNodeParams): Promise<RFTeamMemberNode> {
    console.log('[TeamMemberService] Updating team member node:', params);
    
    try {
      const { id, ...updateData } = params;
      const result = await this.storage.updateNode(id, updateData as Partial<RFTeamMemberNodeData>);
      console.log('[TeamMemberService] Updated team member node:', result);
      return result as RFTeamMemberNode;
    } catch (error) {
      console.error('[TeamMemberService] Error updating team member node:', error);
      throw error;
    }
  }

  /**
   * Delete a team member node from the database
   * @param id The team member ID
   */
  async delete(id: string): Promise<void> {
    console.log('[TeamMemberService] Deleting team member node:', id);
    
    try {
      await this.storage.deleteNode(id);
      console.log('[TeamMemberService] Deleted team member node successfully');
    } catch (error) {
      console.error('[TeamMemberService] Error deleting team member node:', error);
      throw error;
    }
  }

  /**
   * Get a team member node by ID
   * @param id The team member ID
   * @returns The team member node or null if not found
   */
  async get(id: string): Promise<RFTeamMemberNode | null> {
    console.log('[TeamMemberService] Getting team member node:', id);
    
    try {
      const result = await this.storage.getNode(id);
      console.log('[TeamMemberService] Retrieved team member node:', result);
      return result as RFTeamMemberNode | null;
    } catch (error) {
      console.error('[TeamMemberService] Error getting team member node:', error);
      throw error;
    }
  }

  /**
   * Get all team member nodes
   * @returns An array of team member nodes
   */
  async getAll(): Promise<RFTeamMemberNode[]> {
    console.log('[TeamMemberService] Getting all team member nodes');
    
    try {
      const result = await this.storage.getNodesByType('teamMember');
      console.log(`[TeamMemberService] Retrieved ${result.length} team member nodes`);
      return result as RFTeamMemberNode[];
    } catch (error) {
      console.error('[TeamMemberService] Error getting all team member nodes:', error);
      throw error;
    }
  }

  /**
   * Create a new edge between team member and another node
   * @param edge The edge to create
   * @returns The created edge
   */
  async createEdge(edge: RFTeamMemberEdge): Promise<RFTeamMemberEdge> {
    console.log('[TeamMemberService] Creating team member edge:', edge);
    
    try {
      const graphEdge = reactFlowToNeo4jEdge(edge);
      const result = await this.storage.createEdge(graphEdge);
      const rfEdge = neo4jToReactFlowEdge(result);
      console.log('[TeamMemberService] Created team member edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[TeamMemberService] Error creating team member edge:', error);
      throw error;
    }
  }

  /**
   * Get an edge by ID
   * @param id The edge ID
   * @returns The edge or null if not found
   */
  async getEdge(id: string): Promise<RFTeamMemberEdge | null> {
    console.log('[TeamMemberService] Getting team member edge:', id);
    
    try {
      const edge = await this.storage.getEdge(id);
      if (!edge) {
        console.log(`[TeamMemberService] No team member edge found with ID: ${id}`);
        return null;
      }
      
      const rfEdge = neo4jToReactFlowEdge(edge);
      console.log('[TeamMemberService] Retrieved team member edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[TeamMemberService] Error getting team member edge:', error);
      throw error;
    }
  }

  /**
   * Update an existing edge
   * @param id The edge ID
   * @param updates The edge updates
   * @returns The updated edge or null if not found
   */
  async updateEdge(id: string, updates: Partial<RFTeamMemberEdge['data']>): Promise<RFTeamMemberEdge | null> {
    console.log('[TeamMemberService] Updating team member edge:', { id, updates });
    
    try {
      const result = await this.storage.updateEdge(id, updates);
      if (!result) {
        console.log(`[TeamMemberService] No team member edge found with ID: ${id}`);
        return null;
      }
      
      const rfEdge = neo4jToReactFlowEdge(result);
      console.log('[TeamMemberService] Updated team member edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[TeamMemberService] Error updating team member edge:', error);
      throw error;
    }
  }

  /**
   * Delete an edge
   * @param id The edge ID
   */
  async deleteEdge(id: string): Promise<void> {
    console.log('[TeamMemberService] Deleting team member edge:', id);
    
    try {
      await this.storage.deleteEdge(id);
      console.log('[TeamMemberService] Deleted team member edge successfully');
    } catch (error) {
      console.error('[TeamMemberService] Error deleting team member edge:', error);
      throw error;
    }
  }

  /**
   * Get all edges connected to a team member node
   * @param nodeId The node ID
   * @param type Optional edge type filter
   * @returns An array of edges
   */
  async getEdges(nodeId: string, type?: string): Promise<RFTeamMemberEdge[]> {
    console.log('[TeamMemberService] Getting edges for team member node:', nodeId);
    
    try {
      const edges = await this.storage.getEdges(nodeId, type);
      
      const rfEdges = edges.map(edge => neo4jToReactFlowEdge(edge));
      console.log(`[TeamMemberService] Retrieved ${rfEdges.length} edges for team member node: ${nodeId}`);
      return rfEdges;
    } catch (error) {
      console.error('[TeamMemberService] Error getting edges for team member node:', error);
      throw error;
    }
  }
}