import { CreateMetaNodeParams, UpdateMetaNodeParams, RFMetaNode, RFMetaEdge } from './meta.types';

export class MetaHandlers {
  private static readonly API_URL = '/api/graph/meta';

  static async create(params: CreateMetaNodeParams): Promise<RFMetaNode> {
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) throw new Error('Failed to create meta node');
    return response.json() as Promise<RFMetaNode>;
  }

  static async update({ id, ...params }: UpdateMetaNodeParams): Promise<RFMetaNode> {
    console.log(`[MetaHandlers] Updating node ${id} with params:`, params);
    
    // Format the position data if it exists
    if (params.position) {
      console.log(`[MetaHandlers] Position data detected:`, params.position);
    }
    
    const url = `${this.API_URL}/${id}`;
    console.log(`[MetaHandlers] Making PATCH request to: ${url}`);
    
    const body = JSON.stringify(params);
    console.log(`[MetaHandlers] Request body: ${body}`);
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MetaHandlers] Update failed with status ${response.status}: ${errorText}`);
        throw new Error(`Failed to update meta node: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`[MetaHandlers] Update successful, received:`, result);
      
      return result as RFMetaNode;
    } catch (error) {
      console.error('[MetaHandlers] Error during update:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    const response = await fetch(`${this.API_URL}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete meta node');
    return true;
  }

  static async createMetaEdge(edge: RFMetaEdge): Promise<RFMetaEdge> {
    const response = await fetch(`${this.API_URL}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge)
    });

    if (!response.ok) throw new Error('Failed to create meta edge');
    return response.json() as Promise<RFMetaEdge>;
  }

  static async getMetaEdge(edgeId: string): Promise<RFMetaEdge | null> {
    const response = await fetch(`${this.API_URL}/edges/${edgeId}`, {
      method: 'GET'
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to get meta edge');
    }
    return response.json() as Promise<RFMetaEdge>;
  }

  static async updateMetaEdge(edgeId: string, updates: Partial<RFMetaEdge['data']>): Promise<RFMetaEdge> {
    const response = await fetch(`${this.API_URL}/edges/${edgeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) throw new Error('Failed to update meta edge');
    return response.json() as Promise<RFMetaEdge>;
  }

  static async deleteMetaEdge(edgeId: string): Promise<boolean> {
    const response = await fetch(`${this.API_URL}/edges/${edgeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete meta edge');
    return true;
  }
}
