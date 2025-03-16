import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, Node, useNodeConnections } from '@xyflow/react';
import { nodeObserver, NodeUpdateType, NodeUpdateCallback, NodeUpdateMetadata } from '@/services/graph/observer/node-observer';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  getNodeManifest, 
  doesNodeSubscribeTo, 
  getSubscribedFields,
  isFieldCritical,
  debugNodeUpdate
} from '@/services/graph/observer/node-manifest';

/**
 * Helper hook to easily connect React Flow nodes with the observer system
 */
export function useNodeObserver<T extends object = any>(
  nodeId: string,
  nodeType: NodeType
) {
  const { getNodes, getEdges } = useReactFlow();
  const connections = useNodeConnections({ id: nodeId });
  const previousDataRef = useRef<T | null>(null);
  
  // Get all nodes connected to this one
  const getConnectedNodeIds = useCallback((filterTypes?: NodeType[]) => {
    const edges = getEdges();
    const connectedIds = edges
      .filter(edge => edge.source === nodeId || edge.target === nodeId)
      .map(edge => edge.source === nodeId ? edge.target : edge.source);
    
    if (!filterTypes || filterTypes.length === 0) {
      return connectedIds;
    }
    
    // Filter by node type if specified
    return connectedIds.filter(id => {
      const node = getNodes().find(n => n.id === id);
      return node && filterTypes.includes(node.type as NodeType);
    });
  }, [nodeId, getEdges, getNodes]);
  
  // Subscribe to updates from nodes of specific types
  const subscribeToNodeTypes = useCallback((
    types: NodeType[],
    callback: NodeUpdateCallback,
    updateType?: NodeUpdateType
  ) => {
    // Get all currently connected nodes of the specified types
    const getConnectedTypeIds = () => getConnectedNodeIds(types);
    
    // Create subscription
    return nodeObserver.subscribeToConnected(
      nodeId,
      getConnectedTypeIds,
      callback,
      updateType
    );
  }, [nodeId, getConnectedNodeIds]);
  
  // Subscribe to updates based on the node manifest
  const subscribeBasedOnManifest = useCallback(() => {
    const manifest = getNodeManifest(nodeType);
    if (!manifest) {
      console.warn(`No manifest found for node type: ${nodeType}`);
      return { refresh: () => {}, unsubscribe: () => {} };
    }
    
    // Get the node types this node should subscribe to
    const subscribedTypes = manifest.subscribes.nodeTypes;
    
    // Create a subscription for each node type
    return subscribeToNodeTypes(
      subscribedTypes,
      (publisherId, publisherData, metadata) => {
        const publisherType = metadata.nodeType || '';
        
        // Check if this node subscribes to the publisher's type
        if (!doesNodeSubscribeTo(nodeType, publisherType)) {
          return;
        }
        
        // Get the fields this node is interested in
        const subscribedFields = getSubscribedFields(nodeType, publisherType);
        
        // Check if any of the affected fields are ones this node subscribes to
        const relevantFields = metadata.affectedFields?.filter(field => 
          subscribedFields.includes(field)
        ) || [];
        
        if (relevantFields.length > 0) {
          console.log(`[NodeObserver] ${nodeType} ${nodeId} received update from ${publisherType} ${publisherId}:`, {
            relevantFields,
            publisherData
          });
          
          // Dispatch a custom event for this specific update
          const event = new CustomEvent('nodeDataUpdated', {
            detail: {
              subscriberId: nodeId,
              subscriberType: nodeType,
              publisherId,
              publisherType,
              relevantFields,
              data: publisherData
            }
          });
          window.dispatchEvent(event);
        }
      }
    );
  }, [nodeId, nodeType, subscribeToNodeTypes]);
  
  // Publish node data updates
  const publishUpdate = useCallback((
    data: T,
    metadata: Partial<NodeUpdateMetadata> = {}
  ) => {
    // Track which fields changed compared to previous data
    const prevData = previousDataRef.current;
    let affectedFields: string[] = [];
    
    if (prevData) {
      // Determine which fields changed
      const allKeys = new Set([
        ...Object.keys(prevData),
        ...Object.keys(data)
      ]);
      
      affectedFields = Array.from(allKeys).filter(key => {
        const prevValue = (prevData as any)[key];
        const newValue = (data as any)[key];
        
        // Special handling for objects and arrays
        if (typeof prevValue === 'object' && prevValue !== null && 
            typeof newValue === 'object' && newValue !== null) {
          return JSON.stringify(prevValue) !== JSON.stringify(newValue);
        }
        
        return prevValue !== newValue;
      });
    } else {
      // First update, consider all fields as affected
      affectedFields = Object.keys(data);
    }
    
    // Update reference
    previousDataRef.current = { ...data };
    
    // Only publish if there are actually changes
    if (affectedFields.length > 0) {
      // Check if any critical fields were affected
      const hasCriticalChanges = affectedFields.some(field => 
        isFieldCritical(nodeType, field)
      );
      
      // Determine update type based on critical changes
      const updateType = hasCriticalChanges 
        ? (metadata.updateType || NodeUpdateType.CONTENT)
        : (metadata.updateType || NodeUpdateType.MINOR);
      
      nodeObserver.publish(nodeId, data, {
        nodeType,
        updateType,
        affectedFields,
        ...metadata
      });
    }
  }, [nodeId, nodeType]);
  
  // Publish updates according to the manifest
  const publishManifestUpdate = useCallback((
    data: T,
    fieldIds: string[],
    metadata: Partial<NodeUpdateMetadata> = {}
  ) => {
    const manifest = getNodeManifest(nodeType);
    if (!manifest) {
      console.warn(`No manifest found for node type: ${nodeType}`);
      return;
    }
    
    // Filter to only include fields that are in the manifest
    const validFieldIds = fieldIds.filter(fieldId => 
      manifest.publishes.fields.some(field => field.id === fieldId)
    );
    
    if (validFieldIds.length === 0) {
      console.warn(`None of the specified fields are in the manifest for ${nodeType}`);
      return;
    }
    
    // Debug the update
    if (process.env.NODE_ENV !== 'production') {
      debugNodeUpdate(nodeType, nodeId, validFieldIds);
    }
    
    // Check if any critical fields were affected
    const hasCriticalChanges = validFieldIds.some(fieldId => 
      isFieldCritical(nodeType, fieldId)
    );
    
    // Determine update type based on critical changes
    const updateType = hasCriticalChanges 
      ? (metadata.updateType || NodeUpdateType.CONTENT)
      : (metadata.updateType || NodeUpdateType.MINOR);
    
    // Publish the update
    nodeObserver.publish(nodeId, data, {
      nodeType,
      updateType,
      affectedFields: validFieldIds,
      ...metadata
    });
  }, [nodeId, nodeType]);
  
  // Cleanup subscriptions when node is unmounted
  useEffect(() => {
    return () => {
      nodeObserver.unsubscribeAll(nodeId);
    };
  }, [nodeId]);
  
  // Automatically refresh subscriptions when connections change
  useEffect(() => {
    // Dispatch a custom event that components can listen for
    const event = new CustomEvent('nodeConnectionsChanged', { 
      detail: { nodeId, connections }
    });
    window.dispatchEvent(event);
  }, [connections, nodeId]);
  
  return {
    publishUpdate,
    publishManifestUpdate,
    subscribeToNodeTypes,
    subscribeBasedOnManifest,
    getConnectedNodeIds
  };
}