import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { CreateMilestoneNodeParams, UpdateMilestoneNodeParams, RFMilestoneNode, RFMilestoneNodeData, RFMilestoneEdge } from './milestone.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge } from './milestone.transform';
import { NodeStatus } from '@/hooks/useNodeStatus';

export class MilestoneService {
  constructor(private storage: IGraphStorage<RFMilestoneNodeData>) {}

  /**
   * Create a new milestone node in the database
   */
  async createMilestoneNode(params: CreateMilestoneNodeParams): Promise<RFMilestoneNode> {
    console.log('[MilestoneService] Creating milestone node:', params);
    
    try {
      // Ensure kpis is a valid array
      const kpis = params.kpis || [];
      
      const node: RFMilestoneNode = {
        id: crypto.randomUUID(),
        type: 'milestone',
        position: params.position || { x: 0, y: 0 },
        data: {
          title: params.title || 'Untitled Milestone',
          description: params.description || '',
          status: params.status || 'planning' as NodeStatus,
          kpis: kpis,
          name: params.title || 'Untitled Milestone', // Default name to title
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      
      // Create a Neo4j-compatible version of the data
      const neo4jData = {
        ...node.data,
        // The transformation function will handle serialization of complex objects
      };
      
      const result = await this.storage.createNode('milestone', neo4jData as RFMilestoneNodeData);
      console.log('[MilestoneService] Created milestone node:', result);
      return result as RFMilestoneNode;
    } catch (error) {
      console.error('[MilestoneService] Error creating milestone node:', error);
      throw error;
    }
  }

  /**
   * Update an existing milestone node in the database
   */
  async updateMilestoneNode(params: UpdateMilestoneNodeParams): Promise<RFMilestoneNode> {
    console.log('[MilestoneService] Updating milestone node:', params);
    
    try {
      const { id, ...updateData } = params;
      const result = await this.storage.updateNode(id, updateData as Partial<RFMilestoneNodeData>);
      console.log('[MilestoneService] Updated milestone node:', result);
      return result as RFMilestoneNode;
    } catch (error) {
      console.error('[MilestoneService] Error updating milestone node:', error);
      throw error;
    }
  }

  /**
   * Delete a milestone node from the database
   */
  async deleteMilestoneNode(id: string): Promise<void> {
    console.log('[MilestoneService] Deleting milestone node:', id);
    
    try {
      await this.storage.deleteNode(id);
      console.log('[MilestoneService] Deleted milestone node successfully');
    } catch (error) {
      console.error('[MilestoneService] Error deleting milestone node:', error);
      throw error;
    }
  }

  /**
   * Get a milestone node by ID
   */
  async getMilestoneNode(id: string): Promise<RFMilestoneNode | null> {
    console.log('[MilestoneService] Getting milestone node:', id);
    
    try {
      const result = await this.storage.getNode(id);
      console.log('[MilestoneService] Retrieved milestone node:', result);
      return result as RFMilestoneNode | null;
    } catch (error) {
      console.error('[MilestoneService] Error getting milestone node:', error);
      throw error;
    }
  }

  /**
   * Get all milestone nodes
   */
  async getAllMilestoneNodes(): Promise<RFMilestoneNode[]> {
    console.log('[MilestoneService] Getting all milestone nodes');
    
    try {
      const result = await this.storage.getNodesByType('milestone');
      console.log(`[MilestoneService] Retrieved ${result.length} milestone nodes`);
      return result as RFMilestoneNode[];
    } catch (error) {
      console.error('[MilestoneService] Error getting all milestone nodes:', error);
      throw error;
    }
  }

  /**
   * Create a new edge between milestone nodes
   */
  async createMilestoneEdge(edge: RFMilestoneEdge): Promise<RFMilestoneEdge> {
    console.log('[MilestoneService] Creating milestone edge:', edge);
    
    try {
      const graphEdge = reactFlowToNeo4jEdge(edge);
      const result = await this.storage.createEdge(graphEdge);
      const rfEdge = neo4jToReactFlowEdge(result);
      console.log('[MilestoneService] Created milestone edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[MilestoneService] Error creating milestone edge:', error);
      throw error;
    }
  }

  /**
   * Get an edge by ID
   */
  async getMilestoneEdge(id: string): Promise<RFMilestoneEdge | null> {
    console.log('[MilestoneService] Getting milestone edge:', id);
    
    try {
      const edge = await this.storage.getEdge(id);
      if (!edge) {
        console.log(`[MilestoneService] No milestone edge found with ID: ${id}`);
        return null;
      }
      
      const rfEdge = neo4jToReactFlowEdge(edge);
      console.log('[MilestoneService] Retrieved milestone edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[MilestoneService] Error getting milestone edge:', error);
      throw error;
    }
  }

  /**
   * Update an existing edge
   */
  async updateMilestoneEdge(id: string, updates: Partial<RFMilestoneEdge>): Promise<RFMilestoneEdge | null> {
    console.log('[MilestoneService] Updating milestone edge:', { id, updates });
    
    try {
      // Extract properties from the updates
      const properties = updates.data || {};
      
      const result = await this.storage.updateEdge(id, properties);
      if (!result) {
        console.log(`[MilestoneService] No milestone edge found with ID: ${id}`);
        return null;
      }
      
      const rfEdge = neo4jToReactFlowEdge(result);
      console.log('[MilestoneService] Updated milestone edge:', rfEdge);
      return rfEdge;
    } catch (error) {
      console.error('[MilestoneService] Error updating milestone edge:', error);
      throw error;
    }
  }

  /**
   * Delete an edge
   */
  async deleteMilestoneEdge(id: string): Promise<void> {
    console.log('[MilestoneService] Deleting milestone edge:', id);
    
    try {
      await this.storage.deleteEdge(id);
      console.log('[MilestoneService] Deleted milestone edge successfully');
    } catch (error) {
      console.error('[MilestoneService] Error deleting milestone edge:', error);
      throw error;
    }
  }

  /**
   * Get all edges connected to a milestone node
   */
  async getMilestoneEdges(nodeId: string, type?: string): Promise<RFMilestoneEdge[]> {
    console.log('[MilestoneService] Getting edges for milestone node:', nodeId);
    
    try {
      const edges = await this.storage.getEdges(nodeId, type);
      
      const rfEdges = edges.map(edge => neo4jToReactFlowEdge(edge));
      console.log(`[MilestoneService] Retrieved ${rfEdges.length} edges for milestone node: ${nodeId}`);
      return rfEdges;
    } catch (error) {
      console.error('[MilestoneService] Error getting edges for milestone node:', error);
      throw error;
    }
  }
} 