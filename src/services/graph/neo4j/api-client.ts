// src/services/graph/neo4j/api-client.ts
import { API_URLS, NodeType } from '@/services/graph/neo4j/api-urls';

export class GraphApiClient {
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