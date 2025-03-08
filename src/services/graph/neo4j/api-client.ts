// src/services/graph/neo4j/api-client.ts
import { API_URLS, NodeType } from '@/services/graph/neo4j/api-urls';

// Maintain a set of blacklisted node IDs that consistently return 404
// This helps prevent infinite API request loops
const blacklistedNodeIds: Set<string> = new Set([
  // Known problematic node ID that's causing infinite requests
  '95c72037-da89-4bfe-af8f-ea847cbdbe87'
]);

// Track failed request counts to auto-blacklist after multiple failures
const failedRequestCounts: Map<string, number> = new Map();
const MAX_FAILED_REQUESTS = 3;

export class GraphApiClient {
  // Add method to check if a node ID is blacklisted
  static isNodeBlacklisted(id: string): boolean {
    return blacklistedNodeIds.has(id);
  }
  
  // Method to add a node to the blacklist
  static blacklistNode(id: string): void {
    console.warn(`🚫 Blacklisting node ID ${id} due to repeated failures`);
    blacklistedNodeIds.add(id);
  }
  
  // Helper to track and potentially blacklist failing nodes
  private static trackFailedRequest(id: string): void {
    const currentCount = failedRequestCounts.get(id) || 0;
    const newCount = currentCount + 1;
    failedRequestCounts.set(id, newCount);
    
    if (newCount >= MAX_FAILED_REQUESTS) {
      this.blacklistNode(id);
    }
  }
  
  static async createNode(nodeType: NodeType, params: any): Promise<any> {
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

  static async updateNode(nodeType: NodeType, id: string, params: any): Promise<any> {
    // Skip request if node is blacklisted
    if (this.isNodeBlacklisted(id)) {
      console.warn(`🚫 Skipping update request for blacklisted node ${id}`);
      return Promise.reject(new Error(`Node ${id} is blacklisted due to previous failures`));
    }
    
    try {
      const response = await fetch(`${API_URLS[nodeType]}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
  
      if (response.status === 404) {
        this.trackFailedRequest(id);
        throw new Error(`Node ${id} not found (404)`);
      }
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update ${nodeType} node: ${response.status} ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      this.trackFailedRequest(id);
      throw error;
    }
  }

  static async deleteNode(nodeType: NodeType, id: string): Promise<boolean> {
    // Skip request if node is blacklisted
    if (this.isNodeBlacklisted(id)) {
      console.warn(`🚫 Skipping delete request for blacklisted node ${id}`);
      return true; // Pretend deletion succeeded since we want to remove it anyway
    }
    
    try {
      const response = await fetch(`${API_URLS[nodeType]}/${id}`, {
        method: 'DELETE'
      });
  
      if (response.status === 404) {
        this.trackFailedRequest(id);
        return true; // Consider it deleted if it doesn't exist
      }
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete ${nodeType} node: ${response.status} ${errorText}`);
      }
      
      return true;
    } catch (error) {
      this.trackFailedRequest(id);
      throw error;
    }
  }

  static async createEdge(nodeType: NodeType, edge: any): Promise<any> {
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
    try {
      const response = await fetch(`${API_URLS[nodeType]}/edges/${edgeId}`, {
        method: 'DELETE'
      });

      // If we get a 404, the edge is already gone, so consider this a success
      if (response.status === 404) {
        console.warn(`Edge ${edgeId} not found - it may have already been deleted.`);
        return true;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete ${nodeType} edge: ${response.status} ${errorText}`);
      }
      
      return true;
    } catch (error) {
      // Log the error but don't rethrow if it's a 404 related error
      if (error instanceof Error && error.message.includes('404')) {
        console.warn(`Edge ${edgeId} deletion failed with 404, treating as already deleted.`);
        return true;
      }
      throw error;
    }
  }
  
  // Add method to fetch node data with blacklist support
  static async getNode(nodeType: NodeType, id: string): Promise<any> {
    // Skip request if node is blacklisted
    if (this.isNodeBlacklisted(id)) {
      console.warn(`🚫 Skipping get request for blacklisted node ${id}`);
      return Promise.reject(new Error(`Node ${id} is blacklisted due to previous failures`));
    }
    
    try {
      const response = await fetch(`${API_URLS[nodeType]}/${id}`);
      
      if (response.status === 404) {
        this.trackFailedRequest(id);
        throw new Error(`Node ${id} not found (404)`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get ${nodeType} node: ${response.status} ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      this.trackFailedRequest(id);
      throw error;
    }
  }
}