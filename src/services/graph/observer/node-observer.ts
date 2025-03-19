/**
 * Types of node update events that can be published
 */
export enum NodeUpdateType {
    POSITION = 'position',
    CONTENT = 'content',
    CONNECTION = 'connection',
    ALLOCATION = 'allocation',
    ATTRIBUTE = 'attribute',
    DELETE = 'delete',
    MINOR = 'minor',
    ANY = 'any'
  }
  
  /**
   * Metadata structure for node updates
   */
  export interface NodeUpdateMetadata {
    updateType: NodeUpdateType;
    timestamp: number;
    affectedFields?: string[];
    source?: 'api' | 'ui' | 'drag' | string;
    nodeType?: string;
  }
  
  /**
   * Callback function type for node updates
   */
  export type NodeUpdateCallback = (
    publisherId: string, 
    data: unknown, 
    metadata: NodeUpdateMetadata
  ) => void;
  
  /**
   * Observer system for node updates
   */
  export class NodeObserver {
    private subscribers: Map<string, Map<string, Map<NodeUpdateType, Set<NodeUpdateCallback>>>> = new Map();
    private debugMode: boolean = process.env.NODE_ENV !== 'production';
    
    /**
     * Enable or disable debug logging
     */
    setDebugMode(enabled: boolean) {
      this.debugMode = enabled;
    }
    
    /**
     * Log debug information if debug mode is enabled
     */
    private debug(...args: unknown[]) {
      if (this.debugMode) {
        console.log('[NodeObserver]', ...args);
      }
    }
    
    /**
     * Subscribe to updates from a specific node with filtering by update type
     */
    subscribe(
      subscriberId: string, 
      publisherId: string, 
      callback: NodeUpdateCallback,
      updateType: NodeUpdateType = NodeUpdateType.ANY
    ) {
      // Initialize maps if they don't exist
      if (!this.subscribers.has(publisherId)) {
        this.subscribers.set(publisherId, new Map());
      }
      
      const publisherMap = this.subscribers.get(publisherId)!;
      
      if (!publisherMap.has(subscriberId)) {
        publisherMap.set(subscriberId, new Map());
      }
      
      const updateTypesMap = publisherMap.get(subscriberId)!;
      
      if (!updateTypesMap.has(updateType)) {
        updateTypesMap.set(updateType, new Set());
      }
      
      // Add the callback
      updateTypesMap.get(updateType)!.add(callback);
      
      this.debug(`${subscriberId} subscribed to ${publisherId} for ${updateType} updates`);
      
      // Return unsubscribe function
      return () => {
        this.unsubscribe(subscriberId, publisherId, callback, updateType);
      };
    }
    
    /**
     * Unsubscribe from specific updates
     */
    unsubscribe(
      subscriberId: string, 
      publisherId: string, 
      callback: NodeUpdateCallback,
      updateType: NodeUpdateType = NodeUpdateType.ANY
    ) {
      const publisherMap = this.subscribers.get(publisherId);
      if (!publisherMap) return;
      
      const updateTypesMap = publisherMap.get(subscriberId);
      if (!updateTypesMap) return;
      
      const callbacks = updateTypesMap.get(updateType);
      if (!callbacks) return;
      
      callbacks.delete(callback);
      
      this.debug(`${subscriberId} unsubscribed from ${publisherId} for ${updateType} updates`);
      
      // Clean up empty sets and maps
      if (callbacks.size === 0) {
        updateTypesMap.delete(updateType);
      }
      
      if (updateTypesMap.size === 0) {
        publisherMap.delete(subscriberId);
      }
      
      if (publisherMap.size === 0) {
        this.subscribers.delete(publisherId);
      }
    }
    
    /**
     * Publish an update to all subscribers
     */
    publish(publisherId: string, data: unknown, metadata: Partial<NodeUpdateMetadata> = {}) {
      const publisherMap = this.subscribers.get(publisherId);
      if (!publisherMap) return;
      
      // Create full metadata object
      const fullMetadata: NodeUpdateMetadata = {
        updateType: metadata.updateType || NodeUpdateType.ANY,
        timestamp: Date.now(),
        ...metadata
      };
      
      this.debug(`Publishing update from ${publisherId}:`, {
        type: fullMetadata.updateType,
        affected: fullMetadata.affectedFields,
        subscribers: publisherMap.size
      });
      
      // Track which subscribers were notified to avoid duplicates
      const notifiedCallbacks = new Set<NodeUpdateCallback>();
      
      // Notify all subscribers
      publisherMap.forEach((updateTypesMap, subscriberId) => {
        // First check for callbacks registered for this specific update type
        const specificCallbacks = updateTypesMap.get(fullMetadata.updateType);
        if (specificCallbacks) {
          specificCallbacks.forEach(callback => {
            if (!notifiedCallbacks.has(callback)) {
              notifiedCallbacks.add(callback);
              try {
                callback(publisherId, data, fullMetadata);
              } catch (error) {
                console.error(`Error in node update callback for subscriber ${subscriberId}:`, error);
              }
            }
          });
        }
        
        // Then check for callbacks registered for ANY update type
        const anyCallbacks = updateTypesMap.get(NodeUpdateType.ANY);
        if (anyCallbacks) {
          anyCallbacks.forEach(callback => {
            if (!notifiedCallbacks.has(callback)) {
              notifiedCallbacks.add(callback);
              try {
                callback(publisherId, data, fullMetadata);
              } catch (error) {
                console.error(`Error in node update callback for subscriber ${subscriberId}:`, error);
              }
            }
          });
        }
      });
    }
    
    /**
     * Subscribe to updates from multiple nodes
     */
    subscribeToMany(
      subscriberId: string, 
      publisherIds: string[], 
      callback: NodeUpdateCallback,
      updateType: NodeUpdateType = NodeUpdateType.ANY
    ) {
      const unsubscribes = publisherIds.map(publisherId => 
        this.subscribe(subscriberId, publisherId, callback, updateType)
      );
      
      return () => unsubscribes.forEach(unsubscribe => unsubscribe());
    }
    
    /**
     * Subscribe to updates from all connected nodes
     */
    subscribeToConnected(
      subscriberId: string, 
      getConnectedNodeIds: () => string[], 
      callback: NodeUpdateCallback,
      updateType: NodeUpdateType = NodeUpdateType.ANY
    ) {
      // Initial subscription
      let unsubscribes: Array<() => void> = [];
      
      const updateSubscriptions = () => {
        // Clean up existing subscriptions
        unsubscribes.forEach(unsubscribe => unsubscribe());
        unsubscribes = [];
        
        // Create new subscriptions
        const connectedIds = getConnectedNodeIds();
        unsubscribes = connectedIds.map(id => this.subscribe(subscriberId, id, callback, updateType));
        
        this.debug(`Updated subscriptions for ${subscriberId}, now connected to:`, connectedIds);
      };
      
      // Set up initial subscriptions
      updateSubscriptions();
      
      // Return function that both updates connections and provides cleanup
      return {
        refresh: updateSubscriptions,
        unsubscribe: () => {
          unsubscribes.forEach(unsubscribe => unsubscribe());
          this.debug(`Removed all subscriptions for ${subscriberId}`);
        }
      };
    }
    
    /**
     * Unsubscribe all subscriptions for a node (when deleted)
     */
    unsubscribeAll(nodeId: string) {
      // Remove as subscriber
      this.subscribers.forEach((publisherMap) => {
        publisherMap.delete(nodeId);
      });
      
      // Remove as publisher
      this.subscribers.delete(nodeId);
      
      this.debug(`Removed all subscriptions for ${nodeId}`);
    }
    
    // Add this method to help debug issues with node observer and API routes
    logApiRouteError(message: string, params: Record<string, unknown>) {
      console.error(`[NodeObserver] API Route Error: ${message}`, params);
      
      // Check for common issues with dynamic route params in Next.js
      if (params && typeof params === 'object' && 'id' in params) {
        console.warn(`
[NodeObserver] Possible Next.js route parameter issue detected.
- In Next.js 13+ App Router, params from dynamic routes need to be properly handled.
- Use 'params?.id' instead of 'params.id' and add null checks.
- If you continue to see "params should be awaited" errors, update your route handlers
  according to Next.js documentation.
        `);
      }
    }
  }
  
  // Create singleton instance
  export const nodeObserver = new NodeObserver();