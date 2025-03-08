"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFProviderNodeData, 
  ProviderCost, 
  DDItem, 
  TeamAllocation
} from '@/services/graph/provider/provider.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { v4 as uuidv4 } from 'uuid';
import { prepareDataForBackend, parseDataFromBackend } from "@/lib/utils";

/**
 * Hook for managing provider node state and operations
 * Separates domain logic from React Flow component state
 */
export function useProviderNode(id: string, data: RFProviderNodeData) {
  const { updateNodeData, setNodes, setEdges, getNodes } = useReactFlow();
  
  // Define JSON fields that need special handling
  const jsonFields = ['costs', 'ddItems', 'teamAllocations', 'memberAllocations'];
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFProviderNodeData;
  }, [data, jsonFields]);
  
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs for debounce timers
  const costsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const ddItemsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Process costs to ensure they're in the correct format
  const processedCosts = useMemo(() => {
    if (!parsedData.costs) return [];
    
    if (Array.isArray(parsedData.costs)) {
      return parsedData.costs;
    }
    
    return [];
  }, [parsedData.costs]);
  
  // Process DD items to ensure they're in the correct format
  const processedDDItems = useMemo(() => {
    if (!parsedData.ddItems) return [];
    
    if (Array.isArray(parsedData.ddItems)) {
      return parsedData.ddItems;
    }
    
    return [];
  }, [parsedData.ddItems]);
  
  // Save team allocations to backend
  const saveTeamAllocationsToBackend = useCallback(async (allocations: TeamAllocation[]) => {
    try {
      await GraphApiClient.updateNode('provider' as NodeType, id, {
        teamAllocations: allocations
      });
    } catch (error) {
      console.error('Failed to save team allocations to backend:', error);
    }
  }, [id]);
  
  // Use the team allocation hook for team-related operations
  const teamAllocationHook = useTeamAllocation(id, parsedData);
  
  // Add the saveTeamAllocationsToBackend function to the teamAllocationHook
  (teamAllocationHook as any).saveTeamAllocationsToBackend = saveTeamAllocationsToBackend;
  
  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.teamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costsFromHook = teamAllocationHook.costs;
  
  // Use the resource allocation hook to manage resource allocations
  const resourceAllocation = useResourceAllocation(parsedData, teamAllocationHook, getNodes);

  // Use the node status hook for status-related operations
  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, parsedData, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });
  
  // Use the duration input hook for duration-related operations
  const duration = useDurationInput(id, parsedData, updateNodeData, {
    maxDays: 90,
    label: "Integration Time",
    fieldName: "duration",
    tip: 'Use "w" for weeks (e.g. "2w" = 2 weeks) or ↑↓ keys. Hold Shift for week increments.'
  });

  // Save duration to backend when it changes
  useEffect(() => {
    if (parsedData.duration !== undefined) {
      // Debounce the save to avoid excessive API calls
      const durationDebounceRef = setTimeout(async () => {
        try {
          await GraphApiClient.updateNode('provider' as NodeType, id, {
            duration: parsedData.duration
          });
        } catch (error) {
          console.error(`Failed to update provider duration:`, error);
        }
      }, 1000);
      
      return () => clearTimeout(durationDebounceRef);
    }
  }, [id, parsedData.duration]);
  
  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFProviderNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('provider' as NodeType, id, apiData);
      
      // Update React Flow state with the original object data (not stringified)
      updateNodeData(id, updates);
    } catch (error) {
      console.error(`Failed to update provider node:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, updateNodeData, jsonFields]);

  // Save costs to backend with debouncing
  const saveCostsToBackend = useCallback(async (costs: ProviderCost[]) => {
    if (costsDebounceRef.current) {
      clearTimeout(costsDebounceRef.current);
    }
    
    costsDebounceRef.current = setTimeout(async () => {
      try {
        await GraphApiClient.updateNode('provider' as NodeType, id, { costs });
      } catch (error) {
        console.error(`Failed to update provider costs:`, error);
        toast.error("Your cost changes couldn't be saved to the database.");
      }
      costsDebounceRef.current = null;
    }, 1000);
  }, [id]);

  // Save ddItems to backend with debouncing
  const saveDDItemsToBackend = useCallback(async (ddItems: DDItem[]) => {
    if (ddItemsDebounceRef.current) {
      clearTimeout(ddItemsDebounceRef.current);
    }
    
    ddItemsDebounceRef.current = setTimeout(async () => {
      try {
        await GraphApiClient.updateNode('provider' as NodeType, id, { ddItems });
      } catch (error) {
        console.error(`Failed to update provider ddItems:`, error);
        toast.error("Your due diligence changes couldn't be saved to the database.");
      }
      ddItemsDebounceRef.current = null;
    }, 1000);
  }, [id]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    updateNodeData(id, { ...parsedData, title: newTitle });
    saveToBackend({ title: newTitle });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    updateNodeData(id, { ...parsedData, description: newDescription });
    saveToBackend({ description: newDescription });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    GraphApiClient.deleteNode('provider' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        setEdges((edges) => {
          const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
          connectedEdges.forEach((edge) => {
            GraphApiClient.deleteEdge('provider' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge:`, error));
          });
          return edges.filter((edge) => edge.source !== id && edge.target !== id);
        });
      })
      .catch((error) => {
        console.error(`Failed to delete provider node:`, error);
        toast.error("The provider couldn't be deleted from the database.");
      });
  }, [id, setNodes, setEdges]);

  // Add a new cost
  const addCost = useCallback(() => {
    const newCost: ProviderCost = {
      id: uuidv4(),
      name: 'New Cost',
      costType: 'fixed',
      details: {
        type: 'fixed',
        amount: 0,
        frequency: 'monthly'
      }
    };
    
    const updatedCosts = [...processedCosts, newCost];
    updateNodeData(id, { ...parsedData, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, parsedData, processedCosts, updateNodeData, saveCostsToBackend]);

  // Update an existing cost
  const updateCost = useCallback((costId: string, updates: Partial<ProviderCost>) => {
    const updatedCosts = processedCosts.map(cost => 
      cost.id === costId ? { ...cost, ...updates } : cost
    );
    
    updateNodeData(id, { ...parsedData, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, parsedData, processedCosts, updateNodeData, saveCostsToBackend]);

  // Remove a cost
  const removeCost = useCallback((costId: string) => {
    const updatedCosts = processedCosts.filter(cost => cost.id !== costId);
    updateNodeData(id, { ...parsedData, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, parsedData, processedCosts, updateNodeData, saveCostsToBackend]);

  // Add a new due diligence item
  const addDDItem = useCallback(() => {
    const newItem: DDItem = {
      id: uuidv4(),
      name: '',
      status: 'pending'
    };
    
    const updatedItems = [...processedDDItems, newItem];
    updateNodeData(id, { ...parsedData, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, parsedData, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Update an existing due diligence item
  const updateDDItem = useCallback((item: DDItem) => {
    const updatedItems = processedDDItems.map(i => 
      i.id === item.id ? { ...i, ...item } : i
    );
    
    updateNodeData(id, { ...parsedData, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, parsedData, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Remove a due diligence item
  const removeDDItem = useCallback((itemId: string) => {
    const updatedItems = processedDDItems.filter(item => item.id !== itemId);
    updateNodeData(id, { ...parsedData, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, parsedData, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (costsDebounceRef.current) clearTimeout(costsDebounceRef.current);
      if (ddItemsDebounceRef.current) clearTimeout(ddItemsDebounceRef.current);
    };
  }, []);

  // Return the hook API
  return useMemo(() => ({
    // State
    title: parsedData.title || '',
    description: parsedData.description || '',
    status,
    processedCosts,
    processedDDItems,
    processedTeamAllocations: teamAllocationsFromHook,
    connectedTeams,
    costs: costsFromHook,
    
    // Handlers
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    
    // Cost handlers
    addCost,
    updateCost,
    removeCost,
    
    // Due diligence handlers
    addDDItem,
    updateDDItem,
    removeDDItem,
    
    // Resource allocation handlers
    handleAllocationChangeLocal: resourceAllocation.handleAllocationChangeLocal,
    handleAllocationCommit: resourceAllocation.handleAllocationCommit,
    calculateMemberAllocations: resourceAllocation.calculateMemberAllocations,
    calculateCostSummary: resourceAllocation.calculateCostSummary,
    requestTeamAllocation: teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    
    // Status
    getStatusColor,
    cycleStatus,
    
    // Duration
    duration,
  }), [
    parsedData.title,
    parsedData.description,
    status,
    processedCosts,
    processedDDItems,
    teamAllocationsFromHook,
    connectedTeams,
    costsFromHook,
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    addCost,
    updateCost,
    removeCost,
    addDDItem,
    updateDDItem,
    removeDDItem,
    resourceAllocation.handleAllocationChangeLocal,
    resourceAllocation.handleAllocationCommit,
    resourceAllocation.calculateMemberAllocations,
    resourceAllocation.calculateCostSummary,
    teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    getStatusColor,
    cycleStatus,
    duration
  ]);
} 