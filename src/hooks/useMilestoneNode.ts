import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useEdges } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { RFMilestoneNodeData, FeatureAllocationSummary, OptionRevenueSummary, KPI, ProviderCostSummary } from '@/services/graph/milestone/milestone.types';
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useMilestoneMetrics } from "@/hooks/useMilestoneMetrics";
import { prepareDataForBackend, parseDataFromBackend } from "@/lib/utils";

/**
 * Hook for managing milestone node state and operations
 * Separates domain logic from React Flow component state
 */
export function useMilestoneNode(id: string, data: RFMilestoneNodeData) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  const metrics = useMilestoneMetrics(id);
  
  // Define JSON fields that need special handling
  const jsonFields = ['featureAllocations', 'optionDetails', 'providerDetails'];
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFMilestoneNodeData;
  }, [data]);
  
  // State for the milestone node
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  
  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const statusDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const metricsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastMetricsRef = useRef<any>(null);

  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFMilestoneNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('milestone' as NodeType, id, apiData);
      
      // Update React Flow state with the original object data (not stringified)
      updateNodeData(id, updates);
      
      console.log(`Updated milestone node ${id}`);
    } catch (error) {
      console.error(`Failed to update milestone node ${id}:`, error);
      toast.error(`Update Failed: Failed to save milestone data to the server.`);
    }
  }, [id, updateNodeData, jsonFields]);
  
  // Helper function to check if a value is a string
  const isString = (value: any): value is string => {
    return typeof value === 'string';
  };
  
  // Override the handleStatusChange to include API persistence
  const persistStatusChange = useCallback((newStatus: NodeStatus) => {
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...parsedData, status: newStatus });
    
    // Clear any existing debounce timer
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current);
    }
    
    // Set a new debounce timer
    statusDebounceRef.current = setTimeout(async () => {
      try {
        // Persist the change to the database
        await saveToBackend({ status: newStatus });
        console.log(`Updated milestone ${id} status to "${newStatus}"`);
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id} status:`, error);
      }
      statusDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Create a wrapper function that matches the signature expected by useNodeStatus
  const handleNodeStatusChange = useCallback((nodeId: string, nodeData: any) => {
    if (nodeData.status && typeof nodeData.status === 'string') {
      persistStatusChange(nodeData.status as NodeStatus);
    }
  }, [persistStatusChange]);

  // Use the standard hook with our wrapper
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    parsedData, 
    handleNodeStatusChange, 
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
  }, [metrics?.completedCount, metrics?.nodeCount, status, persistStatusChange]);

  // Save metrics to backend when they change
  useEffect(() => {
    // Check if metrics have changed significantly
    if (!metrics) {
      return; // Skip if metrics is null or undefined
    }
    
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
    const hasChanged = 
      Math.abs(currentMetrics.totalCost - lastMetrics.totalCost) > 0.01 ||
      Math.abs(currentMetrics.monthlyValue - lastMetrics.monthlyValue) > 0.01 ||
      Math.abs(currentMetrics.teamCosts - lastMetrics.teamCosts) > 0.01 ||
      Math.abs(currentMetrics.providerCosts - lastMetrics.providerCosts) > 0.01;
    
    if (hasChanged) {
      // Update the last metrics ref
      lastMetricsRef.current = currentMetrics;
      
      // Update ReactFlow state for consistency
      updateNodeData(id, { 
        ...parsedData, 
        totalCost: metrics.totalCost,
        monthlyValue: metrics.monthlyValue,
        teamCosts: metrics.teamCosts,
        providerCosts: metrics.providerCosts,
        // Also save summarized feature allocations and option details
        featureAllocations: metrics.featureAllocations.map(feature => ({
          featureId: feature.featureId,
          name: feature.name,
          totalHours: feature.totalHours,
          totalCost: feature.totalCost
        })),
        optionDetails: metrics.optionDetails.map(option => ({
          optionId: option.id,
          name: option.name,
          monthlyRevenue: option.monthlyRevenue
        })),
        // Add provider details
        providerDetails: metrics.providerDetails.map(provider => ({
          id: provider.id,
          name: provider.name,
          amount: provider.amount,
          type: provider.type
        }))
      });
      
      // Clear any existing debounce timer
      if (metricsDebounceRef.current) {
        clearTimeout(metricsDebounceRef.current);
      }
      
      // Set a new debounce timer
      metricsDebounceRef.current = setTimeout(async () => {
        try {
          // Prepare the data for backend save
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
          
          console.log(`[useMilestoneNode] Saving provider details:`, providerDetails);
          
          // Persist the metrics to the database
          await saveToBackend({
            totalCost: metrics.totalCost,
            monthlyValue: metrics.monthlyValue,
            teamCosts: metrics.teamCosts,
            providerCosts: metrics.providerCosts,
            // Stringify complex objects before saving
            featureAllocations,
            optionDetails,
            providerDetails
          });
          
          console.log(`Updated milestone ${id} metrics:`, {
            totalCost: metrics.totalCost,
            monthlyValue: metrics.monthlyValue,
            providerCosts: metrics.providerCosts
          });
        } catch (error: unknown) {
          console.error(`Failed to update milestone ${id} metrics:`, error);
        }
        metricsDebounceRef.current = null;
      }, 2000); // 2 second debounce to avoid excessive API calls
    }
  }, [id, parsedData, metrics, updateNodeData, saveToBackend]);

  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state immediately for responsive UI
    setTitle(newTitle);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...parsedData, title: newTitle });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newTitle !== parsedData.title) {
          // Persist the change to the database
          await saveToBackend({ title: newTitle });
          console.log(`Updated milestone ${id} title to "${newTitle}"`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id}:`, error);
      }
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, parsedData, updateNodeData, saveToBackend]);

  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Update local state immediately for responsive UI
    setDescription(newDescription);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...parsedData, description: newDescription });
    
    // Clear any existing debounce timer
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }
    
    // Set a new debounce timer
    descriptionDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newDescription !== parsedData.description) {
          // Persist the change to the database
          await saveToBackend({ description: newDescription });
          console.log(`Updated milestone ${id} description`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id}:`, error);
      }
      descriptionDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, parsedData, updateNodeData, saveToBackend]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
      if (metricsDebounceRef.current) clearTimeout(metricsDebounceRef.current);
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