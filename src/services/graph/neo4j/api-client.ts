// src/services/graph/neo4j/api-client.ts
import { API_URLS, NodeType } from '@/services/graph/neo4j/api-urls';

// Generic type for node data
export type NodeData = Record<string, unknown>;

// Edge data type
export type EdgeData = {
  id?: string;
  source?: string;
  target?: string;
  from?: string;
  to?: string;
  type?: string;
  data?: Record<string, unknown>;
  properties?: Record<string, unknown>;
};

// Maintain a set of blacklisted node IDs that consistently return 404
// This helps prevent infinite API request loops
const blacklistedNodeIds: Set<string> = new Set();

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

  // Add method to check if there are any blacklisted nodes
  static hasBlacklistedNodes(): boolean {
    return blacklistedNodeIds.size > 0;
  }

  // Clean up blacklisted nodes from the database
  static async cleanupBlacklistedNodes(): Promise<void> {
    // Skip if no blacklisted nodes
    if (!this.hasBlacklistedNodes()) {
      return;
    }
    
    console.log('🧹 Starting cleanup of blacklisted nodes...');
    
    const nodesToRemove = new Set<string>();
    
    for (const nodeId of blacklistedNodeIds) {
      try {
        // Try to delete the node from the database
        await this.deleteNode('feature' as NodeType, nodeId);
        console.log(`✅ Successfully cleaned up blacklisted node: ${nodeId}`);
        nodesToRemove.add(nodeId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          // If the node doesn't exist, we can remove it from the blacklist
          console.log(`Node ${nodeId} not found in database, removing from blacklist`);
          nodesToRemove.add(nodeId);
        } else {
          // If deletion fails for other reasons, just log it - the node stays blacklisted
          console.warn(`⚠️ Failed to clean up blacklisted node ${nodeId}:`, error);
        }
      }
    }

    // Remove successfully cleaned up nodes from the blacklist
    nodesToRemove.forEach(nodeId => {
      blacklistedNodeIds.delete(nodeId);
      failedRequestCounts.delete(nodeId);
      console.log(`🗑️ Removed node ${nodeId} from blacklist`);
    });
  }

  // Remove a node from the blacklist
  static removeFromBlacklist(id: string): void {
    blacklistedNodeIds.delete(id);
    failedRequestCounts.delete(id);
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
  
  static async createNode(nodeType: NodeType, params: NodeData): Promise<NodeData> {
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

  static async updateNode(nodeType: NodeType, id: string, params: NodeData): Promise<NodeData> {
    // Simplified logging for updates
    console.log(`[GraphApiClient][${nodeType}][${id}] 🔍 Updating node`);
    
    // Skip request if node is blacklisted
    if (this.isNodeBlacklisted(id)) {
      console.warn(`🚫 Skipping update request for blacklisted node ${id}`);
      return Promise.reject(new Error(`Node ${id} is blacklisted due to previous failures`));
    }
    
    try {
      // Special handling for teamAllocations to ensure it's properly formatted
      if (params.teamAllocations) {
        // If teamAllocations is already a string, leave it as is
        if (typeof params.teamAllocations === 'string') {
          try {
            // Check if the string is valid JSON
            JSON.parse(params.teamAllocations);
          } catch (e) {
            console.error(`[GraphApiClient][${nodeType}][${id}] ❌ Invalid JSON string for teamAllocations:`, e);
            throw new Error(`Invalid JSON string for teamAllocations: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        } 
        // If it's an array, we need to ensure it's properly formatted
        else if (Array.isArray(params.teamAllocations)) {
          // Validate that each allocation has the required fields
          type TeamAllocation = {
            teamId: string;
            requestedHours: number;
            allocatedMembers: unknown[];
          };
          
          const isValid = params.teamAllocations.every((allocation: unknown) => {
            const teamAlloc = allocation as TeamAllocation;
            const hasTeamId = typeof teamAlloc === 'object' && teamAlloc && typeof teamAlloc.teamId === 'string';
            const hasRequestedHours = typeof teamAlloc === 'object' && teamAlloc && typeof teamAlloc.requestedHours === 'number';
            const hasAllocatedMembers = typeof teamAlloc === 'object' && teamAlloc && Array.isArray(teamAlloc.allocatedMembers);
            
            return hasTeamId && hasRequestedHours && hasAllocatedMembers;
          });
          
          if (!isValid) {
            console.error(`[GraphApiClient][${nodeType}][${id}] ❌ Invalid teamAllocations array`);
            throw new Error('Invalid teamAllocations array. Each allocation must have teamId, requestedHours, and allocatedMembers properties.');
          }
          
          // Special handling for provider node based on transform differences
          if (nodeType === 'provider') {
            console.log(`[GraphApiClient][${nodeType}][${id}] 🔄 Converting teamAllocations to string for provider node`);
            
            try {
              // For provider nodes, make sure teamAllocations is properly structured first
              // Create a completely new array to avoid mutation issues
              const formattedAllocations = params.teamAllocations.map((allocation: unknown) => {
                // Basic validation of fields
                if (!allocation || typeof allocation !== 'object') {
                  console.warn(`[GraphApiClient][${nodeType}][${id}] ⚠️ Invalid allocation object`);
                  return {
                    teamId: '',
                    requestedHours: 0,
                    allocatedMembers: []
                  };
                }
                
                // Type assertion for the allocation object
                type AllocationLike = {
                  teamId?: string | number | unknown;
                  requestedHours?: number | unknown;
                  allocatedMembers?: unknown[] | unknown;
                };
                
                const alloc = allocation as AllocationLike;
                
                // Ensure required fields are present and correctly typed
                const formattedAllocation = {
                  teamId: typeof alloc.teamId === 'string' ? alloc.teamId : String(alloc.teamId || ''),
                  requestedHours: typeof alloc.requestedHours === 'number' ? alloc.requestedHours : 0,
                  allocatedMembers: Array.isArray(alloc.allocatedMembers) ? alloc.allocatedMembers : []
                };
                
                // If requestedHours is 0 or invalid, calculate it from member hours
                if (formattedAllocation.requestedHours === 0 && Array.isArray(alloc.allocatedMembers)) {
                  formattedAllocation.requestedHours = alloc.allocatedMembers.reduce((sum: number, m: unknown) => {
                    const memberLike = m as { hours?: number | string };
                    const hours = typeof memberLike.hours === 'number' ? memberLike.hours : 
                      typeof memberLike.hours === 'string' ? parseFloat(memberLike.hours) : 0;
                    return sum + (isNaN(hours) ? 0 : hours);
                  }, 0);
                }
                
                // Ensure allocated members are properly formatted
                formattedAllocation.allocatedMembers = formattedAllocation.allocatedMembers.map((m: unknown) => {
                  if (!m || typeof m !== 'object') {
                    console.warn(`[GraphApiClient][${nodeType}][${id}] ⚠️ Invalid member object`);
                    return { memberId: '', name: '', hours: 0 };
                  }
                  
                  // Type assertion for the member object
                  type MemberLike = {
                    memberId?: string | number | unknown;
                    name?: string | unknown;
                    hours?: number | string | unknown;
                  };
                  
                  const memberLike = m as MemberLike;
                  
                  return {
                    memberId: typeof memberLike.memberId === 'string' ? memberLike.memberId : String(memberLike.memberId || ''),
                    name: typeof memberLike.name === 'string' ? memberLike.name : String(memberLike.name || ''),
                    hours: typeof memberLike.hours === 'number' ? memberLike.hours : 
                      (typeof memberLike.hours === 'string' && !isNaN(parseFloat(memberLike.hours))) ? 
                        parseFloat(memberLike.hours) : 0
                  };
                });
                
                return formattedAllocation;
              });
              
              // Double-check that we have valid allocations
              type ValidatedAllocation = {
                teamId: string;
                requestedHours: number;
                allocatedMembers: unknown[];
              };
              
              const validatedAllocations = formattedAllocations.filter((allocation: unknown): allocation is ValidatedAllocation => {
                const alloc = allocation as Partial<ValidatedAllocation>;
                return !!allocation && 
                       typeof allocation === 'object' &&
                       typeof alloc.teamId === 'string' && 
                       alloc.teamId.trim() !== '' &&
                       typeof alloc.requestedHours === 'number' &&
                       !isNaN(alloc.requestedHours) &&
                       Array.isArray(alloc.allocatedMembers);
              });
              
              if (validatedAllocations.length !== formattedAllocations.length) {
                console.warn(`[GraphApiClient][${nodeType}][${id}] ⚠️ Filtered out ${formattedAllocations.length - validatedAllocations.length} invalid allocations`);
              }
              
              // Update the params with the validated allocations
              params.teamAllocations = validatedAllocations;
              
              // Then stringify the properly structured array
              const stringified = JSON.stringify(params.teamAllocations);
              
              // Final verification that it's valid JSON before assigning
              JSON.parse(stringified); // Will throw if invalid
              
              params.teamAllocations = stringified;
              
              console.log(`[GraphApiClient][${nodeType}][${id}] ✅ Stringified teamAllocations for provider node`);
            } catch (error) {
              console.error(`[GraphApiClient][${nodeType}][${id}] 🚨 Error processing teamAllocations:`, error);
              throw new Error(`Failed to process teamAllocations: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      }
      
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

  static async createEdge(nodeType: NodeType, edge: EdgeData): Promise<EdgeData> {
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
  static async getNode(nodeType: NodeType, id: string): Promise<NodeData> {
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