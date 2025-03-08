import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useEdges } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { RFMilestoneNodeData, FeatureAllocationSummary, OptionRevenueSummary, KPI, ProviderCostSummary } from '@/services/graph/milestone/milestone.types';
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useMilestoneMetrics } from "@/hooks/useMilestoneMetrics";

/**
 * Hook for managing milestone node state and operations
 * Separates domain logic from React Flow component state
 */
export function useMilestoneNode(id: string, data: RFMilestoneNodeData) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  const metrics = useMilestoneMetrics(id);
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(data.title || '');
  const [description, setDescription] = useState(data.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const statusDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const metricsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastMetricsRef = useRef<{
    totalCost: number;
    monthlyValue: number;
    teamCosts: number;
    providerCosts: number;
  }>({
    totalCost: 0,
    monthlyValue: 0,
    teamCosts: 0,
    providerCosts: 0
  });
  
  // Update local state when props change
  useEffect(() => {
    setTitle(data.title || '');
    setDescription(data.description || '');
  }, [data.title, data.description]);
  
  // Helper function to save data to backend
  const saveToBackend = useCallback(async (updatedData: Partial<RFMilestoneNodeData>) => {
    try {
      // Stringify complex objects before saving to backend
      const processedData: Partial<RFMilestoneNodeData> = { ...updatedData };
      
      // Stringify featureAllocations if it exists and is not already a string
      if (processedData.featureAllocations) {
        // Create a new object without the featureAllocations property
        const { featureAllocations, ...rest } = processedData;
        // Add the stringified featureAllocations as a string property
        processedData.featureAllocations = JSON.stringify(featureAllocations) as unknown as FeatureAllocationSummary[];
      }
      
      // Stringify optionDetails if it exists and is not already a string
      if (processedData.optionDetails) {
        // Create a new object without the optionDetails property
        const { optionDetails, ...rest } = processedData;
        // Add the stringified optionDetails as a string property
        processedData.optionDetails = JSON.stringify(optionDetails) as unknown as OptionRevenueSummary[];
      }
      
      // Stringify providerDetails if it exists and is not already a string
      if (processedData.providerDetails) {
        // Create a new object without the providerDetails property
        const { providerDetails, ...rest } = processedData;
        // Add the stringified providerDetails as a string property
        processedData.providerDetails = JSON.stringify(providerDetails) as unknown as ProviderCostSummary[];
      }
      
      // Stringify kpis if it exists and is not already a string
      if (processedData.kpis) {
        // Create a new object without the kpis property
        const { kpis, ...rest } = processedData;
        // Add the stringified kpis as a string property
        processedData.kpis = JSON.stringify(kpis) as unknown as KPI[];
      }
      
      await GraphApiClient.updateNode('milestone' as NodeType, id, processedData);
      console.log(`Updated milestone ${id}:`, processedData);
    } catch (error) {
      console.error(`Failed to update milestone ${id}:`, error);
      toast.error(`Failed to save changes`, {
        description: `${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }, [id]);
  
  // Helper function to check if a value is a string
  const isString = (value: any): value is string => {
    return typeof value === 'string';
  };
  
  // Override the handleStatusChange to include API persistence
  const persistStatusChange = useCallback((newStatus: NodeStatus) => {
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, status: newStatus });
    
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
  }, [id, data, updateNodeData, saveToBackend]);

  // Create a wrapper function that matches the signature expected by useNodeStatus
  const handleNodeStatusChange = useCallback((nodeId: string, nodeData: any) => {
    if (nodeData.status && typeof nodeData.status === 'string') {
      persistStatusChange(nodeData.status as NodeStatus);
    }
  }, [persistStatusChange]);

  // Use the standard hook with our wrapper
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    data, 
    handleNodeStatusChange, 
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );

  // Auto-update milestone status based on connected nodes
  useEffect(() => {
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
  }, [metrics.completedCount, metrics.nodeCount, status, persistStatusChange]);

  // Save metrics to backend when they change
  useEffect(() => {
    // Check if metrics have changed significantly
    const currentMetrics = {
      totalCost: metrics.totalCost,
      monthlyValue: metrics.monthlyValue,
      teamCosts: metrics.teamCosts,
      providerCosts: metrics.providerCosts
    };
    
    const lastMetrics = lastMetricsRef.current;
    
    // Only update if metrics have changed by more than 0.01
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
        ...data, 
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
  }, [id, data, metrics, updateNodeData, saveToBackend]);

  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state immediately for responsive UI
    setTitle(newTitle);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, title: newTitle });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newTitle !== data.title) {
          // Persist the change to the database
          await saveToBackend({ title: newTitle });
          console.log(`Updated milestone ${id} title to "${newTitle}"`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id}:`, error);
      }
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Update local state immediately for responsive UI
    setDescription(newDescription);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, description: newDescription });
    
    // Clear any existing debounce timer
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }
    
    // Set a new debounce timer
    descriptionDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newDescription !== data.description) {
          // Persist the change to the database
          await saveToBackend({ description: newDescription });
          console.log(`Updated milestone ${id} description`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update milestone ${id}:`, error);
      }
      descriptionDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);
  
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