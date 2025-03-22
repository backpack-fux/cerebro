/**
 * Hook for standardized duration publishing behavior across all node types
 * Prevents circular updates and provides a consistent pattern for duration field handling
 * 
 * @module utils/hooks/useDurationPublishing
 */

import { useCallback, useRef } from 'react';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { NodeUpdateType, NodeUpdateMetadata } from '@/services/graph/observer/node-observer';
import { parseDurationString } from '@/utils/time/duration';

/**
 * Type for the node data with duration field
 */
export interface NodeDataWithDuration {
  duration?: number;
  [key: string]: unknown;
}

/**
 * Options for the useDurationPublishing hook
 */
export interface DurationPublishingOptions {
  /** The field name to be used for publishing */
  fieldName: string;
  /** The type of update to be used */
  updateType?: NodeUpdateType;
  /** Debug name for logging */
  debugName?: string;
}

/**
 * Hook for standardized duration field handling and publishing
 * 
 * Provides a consistent pattern for handling duration updates across all node types
 * while preventing circular updates through several protection mechanisms.
 * 
 * @param nodeId - The ID of the node
 * @param nodeType - The type of the node
 * @param nodeData - The node data
 * @param publishFn - The function to publish updates (optional, direct API call is used if not provided)
 * @param options - Configuration options
 * @returns Object with handlers and utility functions for duration management
 */
export function useDurationPublishing<T extends NodeDataWithDuration>(
  nodeId: string,
  nodeType: NodeType,
  nodeData: T,
  publishFn?: (data: T, fields: string[], metadata?: Partial<NodeUpdateMetadata>) => void,
  options: DurationPublishingOptions = { fieldName: 'duration' }
) {
  // Flag to prevent update loops when handling duration changes
  const isUpdatingRef = useRef(false);
  
  // Reference to store the debounce timeout
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Map to track last update time for fields to prevent rapid updates
  const lastUpdateTimestampRef = useRef<Map<string, number>>(new Map());
  
  // Default options
  const fieldName = options.fieldName || 'duration';
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
   * Handle duration change while preventing update loops
   * Intended to be used with useDurationInput hook
   * 
   * @param value - The new duration value as string
   * @param originalHandler - Original handler from useDurationInput
   */
  const handleDurationChange = useCallback((
    value: string, 
    originalHandler: (value: string) => void
  ) => {
    // If we're already in the middle of an update, don't trigger another
    if (isUpdatingRef.current) {
      console.log(`[${debugName}][${nodeId}] Skipping duration update - already updating`);
      return;
    }
    
    // Parse the value to days to compare with current duration
    const days = parseDurationString(value);
    
    // Check if the duration is actually changing to avoid unnecessary updates
    if (days !== null && days === nodeData[fieldName]) {
      console.log(`[${debugName}][${nodeId}] Skipping duration update - value unchanged`);
      return;
    }
    
    // Check if update is too recent
    if (isUpdateTooRecent(fieldName)) {
      return;
    }

    // Mark that we're updating
    isUpdatingRef.current = true;
    
    // Call the original handler to update the node data
    originalHandler(value);
    
    // Reset the updating flag after a delay
    setTimeout(() => {
      isUpdatingRef.current = false;
      console.log(`[${debugName}][${nodeId}] Duration update complete, flag reset`);
    }, 150);
  }, [nodeId, nodeData, fieldName, isUpdateTooRecent, debugName]);
  
  /**
   * Save duration to backend when it changes
   * Can be used in a useEffect
   * 
   * @returns Cleanup function to cancel any pending updates
   */
  const saveToBackend = useCallback(() => {
    // Clear existing timeout
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    // Use a local reference to track if this specific invocation led to an API call
    const invocationId = Date.now();
    console.log(`[${debugName}][${nodeId}] saveToBackend invoked with ID: ${invocationId}`);
    
    // Skip if the duration is undefined or we're already in an update cycle
    if (nodeData[fieldName] === undefined || isUpdatingRef.current) {
      console.log(`[${debugName}][${nodeId}] Skipping saveToBackend - duration undefined or already updating`);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    
    // Check if this field was updated very recently (within 2 seconds)
    const lastUpdate = lastUpdateTimestampRef.current.get(`save_${fieldName}`) || 0;
    const timeSinceLastUpdate = Date.now() - lastUpdate;
    
    if (timeSinceLastUpdate < 2000) {
      console.log(`[${debugName}][${nodeId}] 🛑 Skipping saveToBackend - ${fieldName} saved ${timeSinceLastUpdate}ms ago`);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    
    // Update timestamp immediately to prevent parallel calls during debounce
    lastUpdateTimestampRef.current.set(`save_${fieldName}`, Date.now());
    
    // Debounce the save to backend with a longer timeout (2 seconds)
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
        const update = { [fieldName]: nodeData[fieldName] } as Partial<T>;
        
        console.log(`[${debugName}][${nodeId}] 💾 Saving ${fieldName} = ${nodeData[fieldName]} to API`);
        
        // Use direct API call to avoid triggering another publish
        GraphApiClient.updateNode(nodeType, nodeId, update)
          .then(() => {
            console.log(`[${debugName}][${nodeId}] ✅ Updated ${fieldName} to ${nodeData[fieldName]}`);
            
            // Mark as recently saved
            lastUpdateTimestampRef.current.set(`save_${fieldName}`, Date.now());
            
            // If a publish function was provided, use it to notify subscribers
            if (publishFn && !isUpdateTooRecent(fieldName, 200)) {
              publishFn(
                { ...nodeData },
                [fieldName],
                { updateType, source: 'duration-update' }
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
    }, 2000); // Increased debounce to 2 seconds
    
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
    
    // Skip if we're currently updating duration and the update includes duration
    if (isUpdatingRef.current && fields.includes(fieldName)) {
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
    handleDurationChange,
    saveToBackend,
    shouldProcessUpdate,
    isUpdating: isUpdatingRef,
    isUpdateTooRecent
  };
} 