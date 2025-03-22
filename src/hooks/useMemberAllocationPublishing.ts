/**
 * Hook for standardized member allocation publishing behavior across all node types
 * Prevents circular updates and provides a consistent pattern for allocation field handling
 * 
 * @module hooks/useMemberAllocationPublishing
 */

import { useCallback, useRef } from 'react';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { NodeUpdateType, NodeUpdateMetadata } from '@/services/graph/observer/node-observer';
import { TeamAllocation } from '@/utils/types/allocation';

/**
 * Type for the node data with team allocations field
 */
export interface NodeDataWithTeamAllocations {
  teamAllocations?: TeamAllocation[];
  [key: string]: unknown;
}

/**
 * Options for the useMemberAllocationPublishing hook
 */
export interface MemberAllocationPublishingOptions {
  /** The field name to be used for publishing */
  fieldName: string;
  /** The type of update to be used */
  updateType?: NodeUpdateType;
  /** Debug name for logging */
  debugName?: string;
}

/**
 * Hook for standardized member allocation field handling and publishing
 * 
 * Provides a consistent pattern for handling allocation updates across all node types
 * while preventing circular updates through several protection mechanisms.
 * 
 * @param nodeId - The ID of the node
 * @param nodeType - The type of the node
 * @param nodeData - The node data
 * @param publishFn - The function to publish updates (optional, direct API call is used if not provided)
 * @param options - Configuration options
 * @returns Object with handlers and utility functions for allocation management
 */
export function useMemberAllocationPublishing<T extends NodeDataWithTeamAllocations>(
  nodeId: string,
  nodeType: NodeType,
  nodeData: T,
  publishFn?: (data: T, fields: string[], metadata?: Partial<NodeUpdateMetadata>) => void,
  options: MemberAllocationPublishingOptions = { fieldName: 'teamAllocations' }
) {
  // Flag to prevent update loops when handling allocation changes
  const isUpdatingRef = useRef(false);
  
  // Reference to store the debounce timeout
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Map to track last update time for fields to prevent rapid updates
  const lastUpdateTimestampRef = useRef<Map<string, number>>(new Map());
  
  // Default options
  const fieldName = options.fieldName || 'teamAllocations';
  const updateType = options.updateType || NodeUpdateType.CONTENT;
  const debugName = options.debugName || `${nodeType}Node`;

  /**
   * Check if an update is too recent (potential circular update)
   * @param field - The field to check
   * @param bufferMs - Buffer time in milliseconds
   * @returns True if update is too recent
   */
  const isUpdateTooRecent = useCallback((field: string, bufferMs: number = 100) => {
    const now = Date.now();
    const lastUpdate = lastUpdateTimestampRef.current.get(field) || 0;
    const timeSinceLastUpdate = now - lastUpdate;
    
    // If the last update was very recent, consider it a potential loop
    if (timeSinceLastUpdate < bufferMs) {
      console.log(`[${debugName}][${nodeId}] Skipping potential circular update for ${field}, last update was ${timeSinceLastUpdate}ms ago`);
      return true;
    }
    
    // Update the timestamp
    lastUpdateTimestampRef.current.set(field, now);
    return false;
  }, [nodeId, debugName]);

  /**
   * Handle allocation change while preventing update loops
   * 
   * @param teamId - The team ID
   * @param memberId - The member ID
   * @param hours - The allocation hours
   * @param originalHandler - Original handler from the resource allocation hook
   */
  const handleAllocationChange = useCallback((
    teamId: string,
    memberId: string, 
    hours: number,
    originalHandler: (teamId: string, memberId: string, hours: number) => void
  ) => {
    // If we're already in the middle of an update, don't trigger another
    if (isUpdatingRef.current) {
      console.log(`[${debugName}][${nodeId}] Skipping allocation update - already updating`);
      return;
    }
    
    // Check if update is too recent
    if (isUpdateTooRecent(`${fieldName}_${teamId}_${memberId}`)) {
      return;
    }

    // Mark that we're updating
    isUpdatingRef.current = true;
    
    // Call the original handler to update the node data
    originalHandler(teamId, memberId, hours);
    
    // Reset the updating flag after a delay
    setTimeout(() => {
      isUpdatingRef.current = false;
      console.log(`[${debugName}][${nodeId}] Allocation update complete, flag reset`);
    }, 150);
  }, [nodeId, fieldName, isUpdateTooRecent, debugName]);

  /**
   * Save allocations to backend with Promise return value
   * Better for imperative calls and chaining
   * 
   * @param teamAllocations - The team allocations to save
   * @returns Promise that resolves when the operation completes
   */
  const saveToBackendAsync = useCallback((teamAllocations: TeamAllocation[]): Promise<boolean> => {
    // Skip if the allocations are undefined or we're already in an update cycle
    if (!teamAllocations || !Array.isArray(teamAllocations) || teamAllocations.length === 0) {
      console.log(`[${debugName}][${nodeId}] Skipping saveToBackendAsync - empty or invalid allocations`);
      return Promise.resolve(false);
    }
    
    if (isUpdatingRef.current) {
      console.log(`[${debugName}][${nodeId}] Skipping saveToBackendAsync - already updating`);
      return Promise.resolve(false);
    }
    
    // Skip if update is too recent
    if (isUpdateTooRecent(fieldName, 200)) {
      return Promise.resolve(false);
    }
    
    // Mark that we're updating
    isUpdatingRef.current = true;
    
    // Return a promise that resolves when the operation completes
    return new Promise((resolve, reject) => {
      try {
        // Enhanced debug logging for provider node allocations
        console.log(`[${debugName}][${nodeId}] saveToBackendAsync: Starting save with ${teamAllocations.length} allocations`, {
          nodeType,
          allocations: teamAllocations,
          isUpdating: isUpdatingRef.current
        });

        // Special validation for provider nodes which are particularly sensitive to format
        if (nodeType === 'provider') {
          // Validate all allocations have required fields
          const allValid = teamAllocations.every(allocation => {
            const hasTeamId = allocation && typeof allocation.teamId === 'string' && allocation.teamId.trim() !== '';
            const hasRequestedHours = allocation && typeof allocation.requestedHours === 'number' && !isNaN(allocation.requestedHours);
            const hasAllocatedMembers = allocation && Array.isArray(allocation.allocatedMembers) && 
              allocation.allocatedMembers.every(m => m && typeof m === 'object' && typeof m.memberId === 'string');
            
            // Log detailed info for debugging
            console.log(`[${debugName}][${nodeId}] Validating allocation for provider:`, {
              teamId: allocation?.teamId,
              hasTeamId,
              requestedHours: allocation?.requestedHours,
              hasRequestedHours,
              allocatedMembersLength: allocation?.allocatedMembers?.length,
              hasAllocatedMembers,
              allocatedMembersValid: allocation && Array.isArray(allocation.allocatedMembers) ? 
                allocation.allocatedMembers.every(m => m && typeof m === 'object' && typeof m.memberId === 'string') : false
            });
            
            return hasTeamId && hasRequestedHours && hasAllocatedMembers;
          });
          
          if (!allValid) {
            console.error(`[${debugName}][${nodeId}] Invalid team allocations for provider node:`, teamAllocations);
            // Let's try to fix it by ensuring all the required fields and proper types
            teamAllocations = teamAllocations
              .filter(allocation => allocation && typeof allocation === 'object') // Filter out null/undefined allocations
              .map(allocation => {
                // Ensure allocation has a valid teamId, defaulting if needed
                const teamId = (allocation.teamId && typeof allocation.teamId === 'string' && allocation.teamId.trim() !== '') 
                  ? allocation.teamId.trim() 
                  : (typeof allocation.teamId === 'number' ? String(allocation.teamId) : '');
                
                // Handle allocatedMembers, ensuring it's an array with valid entries
                const allocatedMembers = Array.isArray(allocation.allocatedMembers) ? 
                  allocation.allocatedMembers
                    .filter(m => m && typeof m === 'object') // Filter out invalid members
                    .map(m => ({
                      memberId: typeof m.memberId === 'string' ? m.memberId : (m.memberId ? String(m.memberId) : ''),
                      name: typeof m.name === 'string' ? m.name : (m.name ? String(m.name) : ''),
                      hours: typeof m.hours === 'number' && !isNaN(m.hours) ? m.hours : 
                        (typeof m.hours === 'string' ? parseFloat(m.hours) || 0 : 0)
                    }))
                  : [];
                
                // Calculate or validate requestedHours
                let requestedHours = typeof allocation.requestedHours === 'number' && !isNaN(allocation.requestedHours) 
                  ? allocation.requestedHours 
                  : 0;
                  
                // If requestedHours is still 0, calculate from allocatedMembers
                if (requestedHours === 0 && allocatedMembers.length > 0) {
                  requestedHours = allocatedMembers.reduce((sum, m) => sum + (m.hours || 0), 0);
                }
                
                return {
                  teamId,
                  requestedHours,
                  allocatedMembers
                };
              })
              // Filter out any allocations that still don't have a valid teamId
              .filter(allocation => allocation.teamId.trim() !== '');
            
            // Log the fixed allocations
            console.log(`[${debugName}][${nodeId}] Fixed team allocations for provider node:`, 
              teamAllocations.map(a => ({ 
                teamId: a.teamId, 
                requestedHours: a.requestedHours, 
                membersCount: a.allocatedMembers.length 
              }))
            );
          }
          
          // Verify that we have at least some valid allocations
          if (teamAllocations.length === 0) {
            console.error(`[${debugName}][${nodeId}] No valid team allocations remain after filtering`);
            return Promise.reject(new Error('No valid team allocations to save'));
          }
        }
        
        // Create update object with the field
        const update = { [fieldName]: teamAllocations } as Partial<T>;
        
        // Use direct API call to avoid triggering another publish
        GraphApiClient.updateNode(nodeType, nodeId, update)
          .then(() => {
            console.log(`[${debugName}][${nodeId}] Updated ${fieldName} (async)`);
            
            // If a publish function was provided, use it to notify subscribers
            if (publishFn && !isUpdateTooRecent(fieldName, 200)) {
              publishFn(
                { ...nodeData, [fieldName]: teamAllocations } as T,
                [fieldName, `${fieldName}_allocatedMembers`],
                { updateType, source: 'allocation-update' }
              );
            }
            
            resolve(true);
          })
          .catch(error => {
            console.error(`[${debugName}][${nodeId}] Failed to update ${fieldName}: ${error}`);
            reject(error);
          })
          .finally(() => {
            // Reset flags
            // Use a delay before resetting the updating flag to prevent race conditions
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 100);
          });
      } catch (error) {
        console.error(`[${debugName}][${nodeId}] Error updating ${fieldName}: ${error}`);
        isUpdatingRef.current = false;
        reject(error);
      }
    });
  }, [nodeId, nodeType, nodeData, fieldName, updateType, publishFn, isUpdateTooRecent, debugName]);

  /**
   * Handle allocation commit while preventing update loops
   * 
   * @param teamId - The team ID
   * @param memberId - The member ID
   * @param hours - The allocation hours
   * @param originalHandler - Original handler from the resource allocation hook
   */
  const handleAllocationCommit = useCallback((
    teamId: string,
    memberId: string, 
    hours: number,
    originalHandler: (teamId: string, memberId: string, hours: number) => void
  ) => {
    // If we're already in the middle of an update, don't trigger another
    if (isUpdatingRef.current) {
      console.log(`[${debugName}][${nodeId}] Skipping allocation commit - already updating`);
      return;
    }
    
    // Check if update is too recent
    if (isUpdateTooRecent(`${fieldName}_${teamId}_${memberId}_commit`)) {
      return;
    }

    // Mark that we're updating
    isUpdatingRef.current = true;
    
    console.log(`[${debugName}][${nodeId}] 🔒 Committing allocation - team:${teamId}, member:${memberId}, hours:${hours}`);
    
    try {
      // Call the original handler to update the node data
      originalHandler(teamId, memberId, hours);
      
      // For option nodes, ensure we always force a save after commit
      if (nodeType === 'option' && nodeData && nodeData[fieldName]) {
        const existingAllocations = Array.isArray(nodeData[fieldName]) 
          ? nodeData[fieldName] as TeamAllocation[]
          : (typeof nodeData[fieldName] === 'string' 
            ? JSON.parse(nodeData[fieldName] as string) as TeamAllocation[]
            : []);
            
        // Create a local copy to prevent mutation
        const allocationsToSave = [...existingAllocations];
        
        // Find the team allocation object
        const teamAllocationIndex = allocationsToSave.findIndex(a => a.teamId === teamId);
        
        if (teamAllocationIndex >= 0) {
          console.log(`[${debugName}][${nodeId}] 🔁 Reinforcing allocation for option node`);
          
          // Set a timeout to force a save after the allocation has been processed
          setTimeout(() => {
            if (existingAllocations && existingAllocations.length > 0) {
              console.log(`[${debugName}][${nodeId}] 💾 Force saving allocations after commit`);
              saveToBackendAsync(existingAllocations).catch(err => {
                console.error(`[${debugName}][${nodeId}] 🔴 Error in forced allocation save:`, err);
              });
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error(`[${debugName}][${nodeId}] 🔴 Error in allocation commit:`, error);
    } finally {
      // Reset the updating flag after a delay
      setTimeout(() => {
        isUpdatingRef.current = false;
        console.log(`[${debugName}][${nodeId}] ✅ Allocation commit complete, flag reset`);
      }, 250);
    }
  }, [nodeId, fieldName, nodeType, nodeData, isUpdateTooRecent, debugName, saveToBackendAsync]);
  
  /**
   * Save allocations to backend when they change
   * Can be used in a useEffect
   * 
   * @param teamAllocations - The team allocations to save
   * @returns Cleanup function to cancel any pending updates
   */
  const saveToBackend = useCallback((teamAllocations: TeamAllocation[]) => {
    // Clear existing timeout
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    // Skip if the allocations are undefined or we're already in an update cycle
    if (!teamAllocations || isUpdatingRef.current) {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    
    // Debounce the save to backend
    debounceRef.current = setTimeout(() => {
      // Skip if we're in the middle of an update
      if (isUpdatingRef.current) {
        console.log(`[${debugName}][${nodeId}] Skipping API call - already updating`);
        debounceRef.current = null;
        return;
      }
      
      // Set the updating flag to true to prevent loops
      isUpdatingRef.current = true;
      
      try {
        // Create update object with the field
        const update = { [fieldName]: teamAllocations } as Partial<T>;
        
        // Use direct API call to avoid triggering another publish
        GraphApiClient.updateNode(nodeType, nodeId, update)
          .then(() => {
            console.log(`[${debugName}][${nodeId}] Updated ${fieldName}`);
            
            // If a publish function was provided, use it to notify subscribers
            if (publishFn && !isUpdateTooRecent(fieldName, 200)) {
              publishFn(
                { ...nodeData, [fieldName]: teamAllocations } as T,
                [fieldName, `${fieldName}_allocatedMembers`],
                { updateType, source: 'allocation-update' }
              );
            }
          })
          .catch(error => {
            console.error(`[${debugName}][${nodeId}] Failed to update ${fieldName}: ${error}`);
          })
          .finally(() => {
            // Reset flags
            debounceRef.current = null;
            
            // Use a delay before resetting the updating flag to prevent race conditions
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 100);
          });
      } catch (error) {
        console.error(`[${debugName}][${nodeId}] Error updating ${fieldName}: ${error}`);
        isUpdatingRef.current = false;
        debounceRef.current = null;
      }
    }, 1000);
    
    // Cleanup function to cancel the timeout
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodeId, nodeType, nodeData, fieldName, updateType, publishFn, isUpdateTooRecent, debugName]);
  
  /**
   * Check if a field update from an event should be processed
   * Used to filter out updates that could cause loops
   * 
   * @param publisherId - The ID of the publisher
   * @param fields - The fields that were updated
   * @returns True if the update should be processed
   */
  const shouldProcessUpdate = useCallback((
    publisherId: string, 
    fields: string[]
  ) => {
    // Skip self updates
    if (publisherId === nodeId) {
      console.log(`[${debugName}][${nodeId}] Skipping self update`);
      return false;
    }
    
    // Skip if we're currently updating allocations and the update includes allocations
    if (isUpdatingRef.current && 
        (fields.includes(fieldName) || fields.includes(`${fieldName}_allocatedMembers`))) {
      console.log(`[${debugName}][${nodeId}] Skipping ${fieldName} update while already updating`);
      return false;
    }
    
    // Skip if any field has been updated too recently
    if (fields.some(field => isUpdateTooRecent(field, 200))) {
      console.log(`[${debugName}][${nodeId}] Skipping update due to recent updates`);
      return false;
    }
    
    return true;
  }, [nodeId, fieldName, isUpdateTooRecent, debugName]);
  
  return {
    handleAllocationChange,
    handleAllocationCommit,
    saveToBackend,
    saveToBackendAsync,
    shouldProcessUpdate,
    isUpdating: isUpdatingRef,
    isUpdateTooRecent
  };
} 