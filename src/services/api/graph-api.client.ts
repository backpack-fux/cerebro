import { API_URLS, NodeType } from '@/services/graph/neo4j/api-urls';

/**
 * Generic API response interface for node operations
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}

/**
 * Generic node parameters for create/update operations
 */
export type NodeParams = Record<string, unknown>;

/**
 * Edge data interface for edge operations
 */
export interface EdgeData {
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

export class GraphApiClient {
  /**
   * Creates a new node of the specified type
   * @param nodeType The type of node to create
   * @param params Node creation parameters
   * @returns API response with the created node data
   */
  static async createNode<T>(nodeType: NodeType, params: NodeParams): Promise<ApiResponse<T>> {
    const response = await fetch(API_URLS[nodeType], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create ${nodeType} node: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * Updates an existing node
   * @param nodeType The type of node to update
   * @param id Node ID
   * @param params Update parameters
   * @returns API response with the updated node data
   */
  static async updateNode<T>(nodeType: NodeType, id: string, params: NodeParams): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URLS[nodeType]}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update ${nodeType} node: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }

  static async deleteNode(nodeType: NodeType, id: string): Promise<boolean> {
    const response = await fetch(`${API_URLS[nodeType]}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete ${nodeType} node: ${response.status} ${errorText}`);
    }
    
    return true;
  }

  /**
   * Creates a new edge
   * @param nodeType The type of node the edge belongs to
   * @param edge Edge data including source and target IDs
   * @returns API response with the created edge data
   */
  static async createEdge<T>(nodeType: NodeType, edge: EdgeData): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URLS[nodeType]}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create ${nodeType} edge: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }

  static async deleteEdge(nodeType: NodeType, edgeId: string): Promise<boolean> {
    const response = await fetch(`${API_URLS[nodeType]}/edges/${edgeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete ${nodeType} edge: ${response.status} ${errorText}`);
    }
    
    return true;
  }
} 