import { CreateMilestoneNodeParams, UpdateMilestoneNodeParams, RFMilestoneNode, RFMilestoneEdge } from './milestone.types';

export class MilestoneHandlers {
  private static readonly API_URL = '/api/graph/milestone';

  static async create(params: CreateMilestoneNodeParams): Promise<RFMilestoneNode> {
    console.log(`[MilestoneHandlers] Creating milestone node with params:`, params);
    
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MilestoneHandlers] Creation failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to create milestone node: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[MilestoneHandlers] Creation successful, received:`, result);
    
    return result as RFMilestoneNode;
  }

  static async update({ id, ...params }: UpdateMilestoneNodeParams): Promise<RFMilestoneNode> {
    console.log(`[MilestoneHandlers] Updating milestone node ${id} with params:`, params);
    
    // Format the position data if it exists
    if (params.position) {
      console.log(`[MilestoneHandlers] Position data detected:`, params.position);
    }
    
    const url = `${this.API_URL}/${id}`;
    console.log(`[MilestoneHandlers] Making PATCH request to: ${url}`);
    
    const body = JSON.stringify(params);
    console.log(`[MilestoneHandlers] Request body: ${body}`);
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MilestoneHandlers] Update failed with status ${response.status}: ${errorText}`);
        throw new Error(`Failed to update milestone node: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`[MilestoneHandlers] Update successful, received:`, result);
      
      return result as RFMilestoneNode;
    } catch (error) {
      console.error('[MilestoneHandlers] Error during update:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    console.log(`[MilestoneHandlers] Deleting milestone node ${id}`);
    
    const response = await fetch(`${this.API_URL}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MilestoneHandlers] Deletion failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to delete milestone node: ${response.status} ${errorText}`);
    }
    
    console.log(`[MilestoneHandlers] Deletion successful for node ${id}`);
    return true;
  }

  static async createMilestoneEdge(edge: RFMilestoneEdge): Promise<RFMilestoneEdge> {
    console.log(`[MilestoneHandlers] Creating milestone edge:`, edge);
    
    const response = await fetch(`${this.API_URL}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MilestoneHandlers] Edge creation failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to create milestone edge: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[MilestoneHandlers] Edge creation successful, received:`, result);
    
    return result as RFMilestoneEdge;
  }

  static async getMilestoneEdge(edgeId: string): Promise<RFMilestoneEdge | null> {
    console.log(`[MilestoneHandlers] Getting milestone edge ${edgeId}`);
    
    const response = await fetch(`${this.API_URL}/edges/${edgeId}`, {
      method: 'GET'
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[MilestoneHandlers] Edge ${edgeId} not found`);
        return null;
      }
      const errorText = await response.text();
      console.error(`[MilestoneHandlers] Edge retrieval failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to get milestone edge: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[MilestoneHandlers] Edge retrieval successful, received:`, result);
    
    return result as RFMilestoneEdge;
  }

  static async updateMilestoneEdge(edgeId: string, updates: Partial<RFMilestoneEdge['data']>): Promise<RFMilestoneEdge> {
    console.log(`[MilestoneHandlers] Updating milestone edge ${edgeId} with:`, updates);
    
    const response = await fetch(`${this.API_URL}/edges/${edgeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MilestoneHandlers] Edge update failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to update milestone edge: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[MilestoneHandlers] Edge update successful, received:`, result);
    
    return result as RFMilestoneEdge;
  }

  static async deleteMilestoneEdge(edgeId: string): Promise<boolean> {
    console.log(`[MilestoneHandlers] Deleting milestone edge ${edgeId}`);
    
    const response = await fetch(`${this.API_URL}/edges/${edgeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MilestoneHandlers] Edge deletion failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to delete milestone edge: ${response.status} ${errorText}`);
    }
    
    console.log(`[MilestoneHandlers] Edge deletion successful for ${edgeId}`);
    return true;
  }
} 