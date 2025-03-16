import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { 
  RFTeamNode, 
  RFTeamNodeData, 
  CreateTeamNodeParams, 
  UpdateTeamNodeParams, 
  RFTeamEdge, 
  Neo4jTeamNodeData } from '@/services/graph/team/team.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge, reactFlowToNeo4j, neo4jToReactFlow } from '@/services/graph/team/team.transform';
import { initializeTeamResources, setupTeamResourcePublishing, updateTeamRoster } from './team-resource-integration';
import { teamResourceObserver } from '../observer/team-resource-observer';

export class TeamService {
  constructor(private storage: IGraphStorage<RFTeamNodeData>) {}

  async create(params: CreateTeamNodeParams): Promise<RFTeamNode> {
    console.log('[TeamService] Creating team node:', params);
    
    try {
      // Default season if not provided
      const defaultSeason = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        name: 'New Season'
      };

      const createdAt = new Date().toISOString();
      const updatedAt = createdAt;
      const title = params.title || 'Untitled Team';

      // Create a complete node with default values
      const node: RFTeamNode = {
        id: crypto.randomUUID(),
        type: 'team',
        position: params.position,
        data: {
          title: title,
          description: params.description || '',
          name: title, // Default name to title
          season: params.season || defaultSeason, // Use default season if not provided
          roster: params.roster || [], // Initialize with empty roster if not provided
          createdAt: createdAt,
          updatedAt: updatedAt,
        },
      };
      
      // Use the transform function to convert to Neo4j format for storage
      const neo4jData = reactFlowToNeo4j(node);
      
      // Create the node in Neo4j
      const result = await this.storage.createNode('team', neo4jData as unknown as RFTeamNodeData);
      
      console.log('[TeamService] Created team node:', result);
      
      // Initialize team resources in the observer
      initializeTeamResources(result as RFTeamNode);
      
      // Set up team to publish resource updates
      setupTeamResourcePublishing(result.id);
      
      return result as RFTeamNode;
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
      const currentNode = await this.storage.getNode(id);
      if (!currentNode) {
        throw new Error(`Team node with ID ${id} not found`);
      }
      
      // Create a merged node with the updates
      const updatedNode: RFTeamNode = {
        ...currentNode as RFTeamNode,
        data: {
          ...(currentNode as RFTeamNode).data,
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      };
      
      // Transform to Neo4j format for storage
      const neo4jData = reactFlowToNeo4j(updatedNode);
      
      // Update the node in Neo4j
      const result = await this.storage.updateNode(id, neo4jData as unknown as Partial<RFTeamNodeData>);
      
      console.log('[TeamService] Updated team node:', result);
      
      // Update team resources in the observer
      initializeTeamResources(result as RFTeamNode);
      
      return result as RFTeamNode;
    } catch (error) {
      console.error('[TeamService] Error updating team node:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('[TeamService] Deleting team node:', id);
    try {
      // Get all edges connected to this team
      const edges = await this.getEdges(id);
      
      // For each connected work node, we should notify them that the team is being deleted
      // This will allow them to update their UI and internal state
      for (const edge of edges) {
        // Check if the edge is connecting to a work node (feature, option, provider)
        if (edge.type === 'team-feature' || edge.type === 'team-option' || edge.type === 'team-provider') {
          console.log(`[TeamService] Notifying work node ${edge.target} about team deletion`);
          
          // We could implement a notification mechanism here if needed
          // For now, the work nodes will handle this when they try to access team resources
        }
      }
      
      // Delete the node from storage
      await this.storage.deleteNode(id);
      
      // Clean up team resources in the observer
      console.log(`[TeamService] Cleaning up team resources for team ${id}`);
      teamResourceObserver.cleanupTeamResources(id);
      
      console.log('[TeamService] Deleted team node successfully');
    } catch (error) {
      console.error('[TeamService] Error deleting team node:', error);
      throw error;
    }
  }

  /**
   * Get a team node by ID
   * @param id The team ID
   * @returns The team node or null if not found
   */
  async getNode(id: string): Promise<RFTeamNode | null> {
    console.log('[TeamService] Getting team node:', id);
    try {
      const node = await this.storage.getNode(id);
      if (!node) {
        console.log(`[TeamService] No team node found with ID: ${id}`);
        return null;
      }
      console.log('[TeamService] Retrieved team node:', node);
      return node as RFTeamNode;
    } catch (error) {
      console.error('[TeamService] Error getting team node:', error);
      throw error;
    }
  }

  // Edge operations
  async createEdge(edge: RFTeamEdge): Promise<RFTeamEdge> {
    const graphEdge = reactFlowToNeo4jEdge(edge);
    const result = await this.storage.createEdge(graphEdge);
    return neo4jToReactFlowEdge(result);
  }

  async getEdges(nodeId: string, type?: string): Promise<RFTeamEdge[]> {
    console.log('[TeamService] Getting edges for team node:', nodeId);
    
    try {
      const edges = await this.storage.getEdges(nodeId, type);
      
      const rfEdges = edges.map(edge => neo4jToReactFlowEdge(edge));
      console.log(`[TeamService] Retrieved ${rfEdges.length} edges for team node: ${nodeId}`);
      return rfEdges;
    } catch (error) {
      console.error('[TeamService] Error getting edges for team node:', error);
      throw error;
    }
  }

  async getEdge(edgeId: string): Promise<RFTeamEdge | null> {
    console.log('[TeamService] Getting team edge:', edgeId);
    try {
      const edge = await this.storage.getEdge(edgeId);
      if (!edge) {
        console.log(`[TeamService] No team edge found with ID: ${edgeId}`);
        return null;
      }
      console.log('[TeamService] Retrieved team edge:', edge);
      return edge as unknown as RFTeamEdge;
    } catch (error) {
      console.error('[TeamService] Error getting team edge:', error);
      throw error;
    }
  }

  async updateEdge(edgeId: string, properties: Partial<RFTeamEdge['data']>): Promise<RFTeamEdge> {
    console.log('[TeamService] Updating team edge:', { edgeId, properties });
    try {
      const result = await this.storage.updateEdge(edgeId, properties);
      console.log('[TeamService] Updated team edge:', result);
      return result as unknown as RFTeamEdge;
    } catch (error) {
      console.error('[TeamService] Error updating team edge:', error);
      throw error;
    }
  }

  async deleteEdge(edgeId: string): Promise<void> {
    console.log('[TeamService] Deleting team edge:', edgeId);
    try {
      await this.storage.deleteEdge(edgeId);
      console.log('[TeamService] Deleted team edge successfully');
    } catch (error) {
      console.error('[TeamService] Error deleting team edge:', error);
      throw error;
    }
  }

  // Team-specific operations
  async addTeamMember(
    teamId: string, 
    memberId: string, 
    allocation: number = 100, 
    role: string = 'member'
  ): Promise<RFTeamEdge> {
    console.log(`[TeamService] Adding team member ${memberId} to team ${teamId}`);
    try {
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
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      
      const roster = [...((teamNode as RFTeamNode).data.roster || [])];
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
      
      // Update the team node - pass the roster directly
      // The transformation layer will handle serialization
      await this.update({
        id: teamId,
        roster,
      });
      
      // After successfully adding the team member, update the team's roster
      const updatedTeam = await this.getNode(teamId);
      if (updatedTeam) {
        // Parse the roster
        let roster = [];
        try {
          if (typeof updatedTeam.data.roster === 'string') {
            roster = JSON.parse(updatedTeam.data.roster);
          } else if (Array.isArray(updatedTeam.data.roster)) {
            roster = updatedTeam.data.roster;
          }
        } catch (error) {
          console.error('[TeamService] Error parsing roster:', error);
        }
        
        // Update team resources with the new roster
        updateTeamRoster(teamId, roster);
      }
      
      return this.createEdge(edge);
    } catch (error) {
      console.error(`[TeamService] Error adding team member ${memberId} to team ${teamId}:`, error);
      throw error;
    }
  }

  async removeTeamMember(teamId: string, memberId: string): Promise<void> {
    console.log(`[TeamService] Removing team member ${memberId} from team ${teamId}`);
    try {
      // Find the edge between team and member
      const edges = await this.getEdges(teamId, 'TEAM_MEMBER');
      const edge = edges.find(e => e.target === memberId);
      
      if (edge) {
        await this.deleteEdge(edge.id);
      }
      
      // Also update the team's roster
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      
      const roster = ((teamNode as RFTeamNode).data.roster || []).filter(m => m.memberId !== memberId);
      
      // Update the team node
      await this.update({
        id: teamId,
        roster,
      });
      
      // After successfully removing the team member, update the team's roster
      const updatedTeam = await this.getNode(teamId);
      if (updatedTeam) {
        // Parse the roster
        let roster = [];
        try {
          if (typeof updatedTeam.data.roster === 'string') {
            roster = JSON.parse(updatedTeam.data.roster);
          } else if (Array.isArray(updatedTeam.data.roster)) {
            roster = updatedTeam.data.roster;
          }
        } catch (error) {
          console.error('[TeamService] Error parsing roster:', error);
        }
        
        // Update team resources with the new roster
        updateTeamRoster(teamId, roster);
      }
    } catch (error) {
      console.error(`[TeamService] Error removing team member ${memberId} from team ${teamId}:`, error);
      throw error;
    }
  }

  async updateTeamMemberAllocation(teamId: string, memberId: string, allocation: number): Promise<void> {
    console.log(`[TeamService] Updating allocation for team member ${memberId} in team ${teamId} to ${allocation}%`);
    try {
      // Find the edge between team and member
      const edges = await this.getEdges(teamId, 'TEAM_MEMBER');
      const edge = edges.find(e => e.target === memberId);
      
      if (edge) {
        // Update the edge allocation
        await this.updateEdge(edge.id, { allocation });
      }
      
      // Also update the team's roster
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      
      const roster = [...((teamNode as RFTeamNode).data.roster || [])];
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
      
      // After successfully updating the allocation, update the team's roster
      const updatedTeam = await this.getNode(teamId);
      if (updatedTeam) {
        // Parse the roster
        let roster = [];
        try {
          if (typeof updatedTeam.data.roster === 'string') {
            roster = JSON.parse(updatedTeam.data.roster);
          } else if (Array.isArray(updatedTeam.data.roster)) {
            roster = updatedTeam.data.roster;
          }
        } catch (error) {
          console.error('[TeamService] Error parsing roster:', error);
        }
        
        // Update team resources with the new roster
        updateTeamRoster(teamId, roster);
      }
    } catch (error) {
      console.error(`[TeamService] Error updating allocation for team member ${memberId} in team ${teamId}:`, error);
      throw error;
    }
  }
} 