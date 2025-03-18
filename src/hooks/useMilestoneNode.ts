import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useEdges } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { useNodeStatus, NodeStatus, NodeData } from "@/hooks/useNodeStatus";
import { useMilestoneMetrics } from "@/hooks/useMilestoneMetrics";
import { prepareDataForBackend, parseDataFromBackend } from "@/utils/utils";
import { useNodeObserver } from '@/hooks/useNodeObserver';

/**
 * Hook for managing milestone node state and operations
 * Separates domain logic from React Flow component state
 */
export function useMilestoneNode(id: string, data: RFMilestoneNodeData) {
  const { updateNodeData, setNodes } = useReactFlow();
  const edges = useEdges();
  const metrics = useMilestoneMetrics(id);
  
  // Initialize node observer
  const { publishManifestUpdate, subscribeBasedOnManifest } = useNodeObserver<RFMilestoneNodeData>(id, 'milestone');
  
  // Define JSON fields that need special handling
  const jsonFields = useMemo(() => ['featureAllocations', 'optionDetails', 'providerDetails'], []);
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFMilestoneNodeData;
  }, [data, jsonFields]);
  
  // State for the milestone node
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  
  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const statusDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const metricsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastMetricsRef = useRef<Record<string, number> | null>(null);

  // Persistent reference to avoid recreating the function
  const persistToBackend = useRef(true);

  // Subscribe to updates from other nodes based on manifest
  useEffect(() => {
    if (!id) return;
    
    const { unsubscribe } = subscribeBasedOnManifest();
    
    // Listen for node data updates
    const handleNodeDataUpdated = (event: CustomEvent) => {
      const { subscriberId, publisherType, publisherId, relevantFields, data } = event.detail;
      
      if (subscriberId !== id) return;
      
      console.log(`Milestone node ${id} received update from ${publisherType} ${publisherId}:`, {
        relevantFields,
        data
      });
      
      // Handle updates based on publisher type and relevant fields
      // This can be expanded based on specific needs
    };
    
    window.addEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    };
  }, [id, subscribeBasedOnManifest]);

  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFMilestoneNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('milestone' as NodeType, id, apiData);
      
      // Update React Flow state with the original object data (not stringified)
      updateNodeData(id, updates);
      
      // Determine which fields were updated
      const affectedFields = Object.keys(updates).map(key => {
        // Map the property name to the field ID in the manifest
        // This is a simplified approach - you might need a more sophisticated mapping
        return key.toLowerCase();
      });
      
      // Publish the update to subscribers
      const updatedData = { ...parsedData, ...updates };
      publishManifestUpdate(updatedData, affectedFields);
      
      return true;
    } catch (error) {
      console.error('Error saving milestone node:', error);
      toast.error('Failed to save milestone data');
      return false;
    }
  }, [id, jsonFields, updateNodeData, parsedData, publishManifestUpdate]);
  
  // Persist status change with debouncing
  const persistStatusChange = useCallback(async (status: NodeStatus) => {
    // Clear any existing debounce timer
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current);
    }
    
    // Set a new debounce timer
    statusDebounceRef.current = setTimeout(async () => {
      try {
        const success = await saveToBackend({ status });
        if (success) {
          console.log(`Updated milestone ${id} status to "${status}"`);
        } else {
          console.warn(`Failed to update milestone ${id} status`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id} status:`, error);
        toast.error(`Failed to update milestone status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        statusDebounceRef.current = null;
      }
    }, 500); // 500ms debounce
  }, [id, saveToBackend]);

  // Create a wrapper for useNodeStatus that updates the node and persists changes
  const handleStatusChange = useCallback((nodeId: string, data: NodeData) => {
    // Update the node data in ReactFlow
    updateNodeData(nodeId, data);
    
    // Publish notification to other nodes that might be listening
    if (data.status) {
      publishManifestUpdate({ ...parsedData, ...data }, ['status']);
      
      // Also persist to backend if required
      if (persistToBackend.current) {
        persistStatusChange(data.status);
      }
    }
  }, [updateNodeData, publishManifestUpdate, persistStatusChange, parsedData]);
  
  // Use the node status hook
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id,
    parsedData,
    handleStatusChange,
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );

  // Auto-update milestone status based on connected nodes
  useEffect(() => {
    if (!metrics) {
      return; // Skip if metrics is null or undefined
    }
    
    if (metrics.nodeCount > 0) {
      let newStatus: NodeStatus = 'planning';
      
      const completionPercentage = (metrics.completedCount / metrics.nodeCount) * 100;
      
      if (completionPercentage === 100) {
        newStatus = 'completed';
      } else if (completionPercentage > 0) {
        newStatus = 'in_progress';
      }

      if (newStatus !== status) {
        persistStatusChange(newStatus);
      }
    }
  }, [metrics, status, persistStatusChange]);

  // Save metrics to backend when they change
  useEffect(() => {
    if (!metrics) return; // Skip if metrics is null or undefined
    
    // Helper function to check if metrics have changed significantly
    const hasMetricsChanged = (): boolean => {
      const currentMetrics = {
        totalCost: metrics.totalCost,
        monthlyValue: metrics.monthlyValue,
        teamCosts: metrics.teamCosts,
        providerCosts: metrics.providerCosts
      };
      
      const lastMetrics = lastMetricsRef.current || {
        totalCost: 0,
        monthlyValue: 0,
        teamCosts: 0,
        providerCosts: 0
      };
      
      // Check if any value has changed by more than 1 cent
      return (
        Math.abs(currentMetrics.totalCost - lastMetrics.totalCost) > 0.01 ||
        Math.abs(currentMetrics.monthlyValue - lastMetrics.monthlyValue) > 0.01 ||
        Math.abs(currentMetrics.teamCosts - lastMetrics.teamCosts) > 0.01 ||
        Math.abs(currentMetrics.providerCosts - lastMetrics.providerCosts) > 0.01
      );
    };
    
    // Helper function to prepare metrics for NodeData update
    const prepareMetricsForNodeData = () => {
      const featureAllocations = metrics.featureAllocations.map(feature => ({
        featureId: feature.featureId,
        name: feature.name,
        totalHours: feature.totalHours,
        totalCost: feature.totalCost
      }));
      
      const optionDetails = metrics.optionDetails.map(option => ({
        optionId: option.id,
        name: option.name,
        monthlyRevenue: option.monthlyRevenue
      }));
      
      const providerDetails = metrics.providerDetails.map(provider => ({
        id: provider.id,
        name: provider.name,
        amount: provider.amount,
        type: provider.type
      }));
      
      return {
        totalCost: metrics.totalCost,
        monthlyValue: metrics.monthlyValue,
        teamCosts: metrics.teamCosts,
        providerCosts: metrics.providerCosts,
        featureAllocations,
        optionDetails,
        providerDetails
      };
    };
    
    // Only proceed if metrics have changed
    if (!hasMetricsChanged()) return;
    
    // Update the last metrics ref
    lastMetricsRef.current = {
      totalCost: metrics.totalCost,
      monthlyValue: metrics.monthlyValue,
      teamCosts: metrics.teamCosts,
      providerCosts: metrics.providerCosts
    };
    
    // Prepare updated node data
    const metricsData = prepareMetricsForNodeData();
    
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...parsedData, ...metricsData });
    
    // Clear any existing debounce timer
    if (metricsDebounceRef.current) {
      clearTimeout(metricsDebounceRef.current);
    }
    
    // Set a new debounce timer
    metricsDebounceRef.current = setTimeout(async () => {
      try {
        // Persist the metrics to the database
        await saveToBackend(metricsData);
        
        console.log(`Updated milestone ${id} metrics:`, {
          totalCost: metrics.totalCost,
          monthlyValue: metrics.monthlyValue,
          providerCosts: metrics.providerCosts
        });
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id} metrics:`, error);
        toast.error(`Failed to update metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        metricsDebounceRef.current = null;
      }
    }, 2000); // 2 second debounce to avoid excessive API calls
  }, [id, parsedData, metrics, updateNodeData, saveToBackend]);

  // Generic debounced change handler with separate implementation for string fields
  const createDebouncedStringHandler = useCallback((
    field: 'title' | 'description',
    value: string,
    setLocalState: React.Dispatch<React.SetStateAction<string>>,
    debouncedRef: React.MutableRefObject<NodeJS.Timeout | null>,
    debounceTime = 1000
  ) => {
    // Update local state immediately for responsive UI
    setLocalState(value);
    
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...parsedData, [field]: value });
    
    // Clear any existing debounce timer
    if (debouncedRef.current) {
      clearTimeout(debouncedRef.current);
    }
    
    // Set a new debounce timer
    debouncedRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (value !== parsedData[field]) {
          // Persist the change to the database
          const success = await saveToBackend({ [field]: value });
          if (success) {
            console.log(`Updated milestone ${id} ${field} to "${value}"`);
          }
        }
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id} ${field}:`, error);
        toast.error(`Failed to update milestone ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        debouncedRef.current = null;
      }
    }, debounceTime);
  }, [id, parsedData, updateNodeData, saveToBackend]);

  const handleTitleChange = useCallback((newTitle: string) => {
    createDebouncedStringHandler('title', newTitle, setTitle, titleDebounceRef);
  }, [createDebouncedStringHandler]);

  const handleDescriptionChange = useCallback((newDescription: string) => {
    createDebouncedStringHandler('description', newDescription, setDescription, descriptionDebounceRef);
  }, [createDebouncedStringHandler]);
  
  // Clean up timers on unmount
  useEffect(() => {
    // Save references to timers to avoid React hooks exhaustive-deps warning
    const titleTimer = titleDebounceRef.current;
    const descriptionTimer = descriptionDebounceRef.current;
    const statusTimer = statusDebounceRef.current;
    const metricsTimer = metricsDebounceRef.current;
    
    return () => {
      if (titleTimer) clearTimeout(titleTimer);
      if (descriptionTimer) clearTimeout(descriptionTimer);
      if (statusTimer) clearTimeout(statusTimer);
      if (metricsTimer) clearTimeout(metricsTimer);
    };
  }, []);

  const handleDelete = useCallback(() => {
    // First delete the node from the database
    GraphApiClient.deleteNode('milestone' as NodeType, id)
      .then(() => {
        console.log(`Successfully deleted milestone node ${id}`);
        // Then remove it from the UI
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete associated edges
        const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
        connectedEdges.forEach((edge) => {
          GraphApiClient.deleteEdge('milestone' as NodeType, edge.id)
            .catch((error: unknown) => console.error(`Failed to delete edge ${edge.id}:`, error));
        });
      })
      .catch((error: unknown) => {
        console.error(`Failed to delete milestone node ${id}:`, error);
      });
  }, [id, setNodes, edges]);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    title,
    description,
    status,
    metrics,
    
    // Actions
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    cycleStatus,
    
    // Utilities
    getStatusColor
  }), [
    title,
    description,
    status,
    metrics,
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    cycleStatus,
    getStatusColor
  ]);
} 