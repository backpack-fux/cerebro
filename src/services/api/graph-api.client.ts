import { API_URLS, NodeType } from '@/services/graph/neo4j/api-urls';

/**
 * Generic API response interface for node operations
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  details?: string;
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
    try {
      console.log(`[GraphApiClient] Creating ${nodeType} node:`, params);
      const response = await fetch(API_URLS[nodeType], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        // Try to parse error response as JSON
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          // If not JSON, get text
          errorDetails = await response.text();
        }
        
        const errorMessage = typeof errorDetails === 'object' && errorDetails.error 
          ? errorDetails.error 
          : typeof errorDetails === 'string' 
            ? errorDetails 
            : `HTTP ${response.status}`;
        
        console.error(`[GraphApiClient] Failed to create ${nodeType} node:`, {
          status: response.status,
          error: errorMessage,
          details: errorDetails
        });
        
        return {
          success: false,
          data: {} as T,
          error: `Failed to create ${nodeType} node`,
          details: errorMessage
        };
      }
      
      const result = await response.json();
      console.log(`[GraphApiClient] Successfully created ${nodeType} node:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`[GraphApiClient] Exception creating ${nodeType} node:`, error);
      const isConnectionError = 
        error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Network request failed'));
         
      const errorMessage = isConnectionError 
        ? 'Connection to server failed. Please check if the server is running.' 
        : error instanceof Error ? error.message : 'Unknown error';
        
      return {
        success: false,
        data: {} as T,
        error: `Error creating ${nodeType} node`,
        details: errorMessage
      };
    }
  }

  /**
   * Updates an existing node
   * @param nodeType The type of node to update
   * @param id Node ID
   * @param params Update parameters
   * @returns API response with the updated node data
   */
  static async updateNode<T>(nodeType: NodeType, id: string, params: NodeParams): Promise<ApiResponse<T>> {
    try {
      console.log(`[GraphApiClient] Updating ${nodeType} node:`, { id, params });
      const response = await fetch(`${API_URLS[nodeType]}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        // Try to parse error response as JSON
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          // If not JSON, get text
          errorDetails = await response.text();
        }
        
        const errorMessage = typeof errorDetails === 'object' && errorDetails.error 
          ? errorDetails.error 
          : typeof errorDetails === 'string' 
            ? errorDetails 
            : `HTTP ${response.status}`;
            
        console.error(`[GraphApiClient] Failed to update ${nodeType} node:`, {
          status: response.status,
          error: errorMessage,
          details: errorDetails
        });
        
        return {
          success: false,
          data: {} as T,
          error: `Failed to update ${nodeType} node`,
          details: errorMessage
        };
      }
      
      const result = await response.json();
      console.log(`[GraphApiClient] Successfully updated ${nodeType} node:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`[GraphApiClient] Exception updating ${nodeType} node:`, error);
      const isConnectionError = 
        error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Network request failed'));
         
      const errorMessage = isConnectionError 
        ? 'Connection to server failed. Please check if the server is running.' 
        : error instanceof Error ? error.message : 'Unknown error';
        
      return {
        success: false,
        data: {} as T,
        error: `Error updating ${nodeType} node`,
        details: errorMessage
      };
    }
  }

  static async deleteNode(nodeType: NodeType, id: string): Promise<ApiResponse<boolean>> {
    try {
      console.log(`[GraphApiClient] Deleting ${nodeType} node:`, id);
      const response = await fetch(`${API_URLS[nodeType]}/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        // Try to parse error response as JSON
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          // If not JSON, get text
          errorDetails = await response.text();
        }
        
        const errorMessage = typeof errorDetails === 'object' && errorDetails.error 
          ? errorDetails.error 
          : typeof errorDetails === 'string' 
            ? errorDetails 
            : `HTTP ${response.status}`;
            
        console.error(`[GraphApiClient] Failed to delete ${nodeType} node:`, {
          status: response.status,
          error: errorMessage,
          details: errorDetails
        });
        
        return {
          success: false,
          data: false,
          error: `Failed to delete ${nodeType} node`,
          details: errorMessage
        };
      }
      
      console.log(`[GraphApiClient] Successfully deleted ${nodeType} node:`, id);
      return {
        success: true,
        data: true
      };
    } catch (error) {
      console.error(`[GraphApiClient] Exception deleting ${nodeType} node:`, error);
      const isConnectionError = 
        error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Network request failed'));
         
      const errorMessage = isConnectionError 
        ? 'Connection to server failed. Please check if the server is running.' 
        : error instanceof Error ? error.message : 'Unknown error';
        
      return {
        success: false,
        data: false,
        error: `Error deleting ${nodeType} node`,
        details: errorMessage
      };
    }
  }

  /**
   * Creates a new edge
   * @param nodeType The type of node the edge belongs to
   * @param edge Edge data including source and target IDs
   * @returns API response with the created edge data
   */
  static async createEdge<T>(nodeType: NodeType, edge: EdgeData): Promise<ApiResponse<T>> {
    try {
      console.log(`[GraphApiClient] Creating ${nodeType} edge:`, edge);
      const response = await fetch(`${API_URLS[nodeType]}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edge)
      });

      if (!response.ok) {
        // Try to parse error response as JSON
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          // If not JSON, get text
          errorDetails = await response.text();
        }
        
        const errorMessage = typeof errorDetails === 'object' && errorDetails.error 
          ? errorDetails.error 
          : typeof errorDetails === 'string' 
            ? errorDetails 
            : `HTTP ${response.status}`;
            
        console.error(`[GraphApiClient] Failed to create ${nodeType} edge:`, {
          status: response.status,
          error: errorMessage,
          details: errorDetails
        });
        
        return {
          success: false,
          data: {} as T,
          error: `Failed to create ${nodeType} edge`,
          details: errorMessage
        };
      }
      
      const result = await response.json();
      console.log(`[GraphApiClient] Successfully created ${nodeType} edge:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`[GraphApiClient] Exception creating ${nodeType} edge:`, error);
      const isConnectionError = 
        error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Network request failed'));
         
      const errorMessage = isConnectionError 
        ? 'Connection to server failed. Please check if the server is running.' 
        : error instanceof Error ? error.message : 'Unknown error';
        
      return {
        success: false,
        data: {} as T,
        error: `Error creating ${nodeType} edge`,
        details: errorMessage
      };
    }
  }

  static async deleteEdge(nodeType: NodeType, edgeId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log(`[GraphApiClient] Deleting ${nodeType} edge:`, edgeId);
      const response = await fetch(`${API_URLS[nodeType]}/edges/${edgeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        // Try to parse error response as JSON
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          // If not JSON, get text
          errorDetails = await response.text();
        }
        
        const errorMessage = typeof errorDetails === 'object' && errorDetails.error 
          ? errorDetails.error 
          : typeof errorDetails === 'string' 
            ? errorDetails 
            : `HTTP ${response.status}`;
            
        console.error(`[GraphApiClient] Failed to delete ${nodeType} edge:`, {
          status: response.status,
          error: errorMessage,
          details: errorDetails
        });
        
        return {
          success: false,
          data: false,
          error: `Failed to delete ${nodeType} edge`,
          details: errorMessage
        };
      }
      
      console.log(`[GraphApiClient] Successfully deleted ${nodeType} edge:`, edgeId);
      return {
        success: true,
        data: true
      };
    } catch (error) {
      console.error(`[GraphApiClient] Exception deleting ${nodeType} edge:`, error);
      const isConnectionError = 
        error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Network request failed'));
         
      const errorMessage = isConnectionError 
        ? 'Connection to server failed. Please check if the server is running.' 
        : error instanceof Error ? error.message : 'Unknown error';
        
      return {
        success: false,
        data: false,
        error: `Error deleting ${nodeType} edge`,
        details: errorMessage
      };
    }
  }
} 