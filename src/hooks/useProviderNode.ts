"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFProviderNodeData, 
  ProviderCost, 
  DDItem, 
  CostType, 
  FixedCost, 
  UnitCost, 
  RevenueCost, 
  TieredCost, 
  DDStatus,
  TierRange,
  TeamAllocation
} from '@/services/graph/provider/provider.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { NodeStatus } from "@/services/graph/shared/shared.types";
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for managing provider node state and operations
 * Separates domain logic from React Flow component state
 */
export function useProviderNode(id: string, data: RFProviderNodeData) {
  const { updateNodeData, setNodes, setEdges, getNodes } = useReactFlow();
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const costsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const ddItemsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });
  
  // Process team allocations to ensure it's always an array
  const processedTeamAllocations = useMemo(() => {
    if (Array.isArray(data.teamAllocations)) {
      return data.teamAllocations;
    } else if (typeof data.teamAllocations === 'string') {
      try {
        const parsed = JSON.parse(data.teamAllocations);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
      }
    }
    return [];
  }, [data.teamAllocations]);
  
  // Process costs to ensure it's always an array
  const processedCosts = useMemo(() => {
    if (Array.isArray(data.costs)) {
      return data.costs;
    } else if (typeof data.costs === 'string') {
      try {
        const parsed = JSON.parse(data.costs);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse costs string:', e);
      }
    }
    return [];
  }, [data.costs]);
  
  // Process ddItems to ensure it's always an array
  const processedDDItems = useMemo(() => {
    if (Array.isArray(data.ddItems)) {
      return data.ddItems;
    } else if (typeof data.ddItems === 'string') {
      try {
        const parsed = JSON.parse(data.ddItems);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse ddItems string:', e);
      }
    }
    return [];
  }, [data.ddItems]);
  
  // Save team allocations to backend
  const saveTeamAllocationsToBackend = useCallback(async (allocations: TeamAllocation[]) => {
    try {
      // Log the team allocations before sending to backend
      console.log('Team allocations being sent to backend:', JSON.stringify(allocations, null, 2));
      
      await GraphApiClient.updateNode('provider' as NodeType, id, {
        teamAllocations: allocations
      });
      console.log('✅ Successfully saved team allocations to backend');
    } catch (error) {
      console.error('❌ Failed to save team allocations to backend:', error);
    }
  }, [id]);
  
  // Use the team allocation hook for team-related operations
  const teamAllocationHook = useTeamAllocation(id, data);
  
  // Add the saveTeamAllocationsToBackend function to the teamAllocationHook
  (teamAllocationHook as any).saveTeamAllocationsToBackend = saveTeamAllocationsToBackend;
  
  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.teamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costs = teamAllocationHook.costs;
  
  // Use the resource allocation hook to manage resource allocations
  const resourceAllocation = useResourceAllocation(data, teamAllocationHook, getNodes);

  // Use the node status hook for status-related operations
  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, data, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });
  
  // Use the duration input hook for duration-related operations
  const duration = useDurationInput(id, data, updateNodeData, {
    maxDays: 90,
    label: "Integration Time",
    fieldName: "duration",
    tip: 'Use "w" for weeks (e.g. "2w" = 2 weeks) or ↑↓ keys. Hold Shift for week increments.'
  });
  
  // Function to save data to backend with debouncing
  const saveToBackend = useCallback(async (field: string, value: any) => {
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    titleDebounceRef.current = setTimeout(async () => {
      try {
        const updateData = { [field]: value };
        await GraphApiClient.updateNode('provider' as NodeType, id, updateData);
        console.log(`Updated provider ${id} field ${field}`);
      } catch (error) {
        console.error(`Failed to update provider ${id} field ${field}:`, error);
        toast.error("Your changes couldn't be saved to the database.");
      }
      titleDebounceRef.current = null;
    }, 1000);
  }, [id]);

  // Save costs to backend with debouncing
  const saveCostsToBackend = useCallback(async (costs: ProviderCost[]) => {
    if (costsDebounceRef.current) {
      clearTimeout(costsDebounceRef.current);
    }
    
    costsDebounceRef.current = setTimeout(async () => {
      try {
        await GraphApiClient.updateNode('provider' as NodeType, id, { costs });
        console.log(`Updated provider ${id} costs`);
      } catch (error) {
        console.error(`Failed to update provider ${id} costs:`, error);
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
        console.log(`Updated provider ${id} ddItems`);
      } catch (error) {
        console.error(`Failed to update provider ${id} ddItems:`, error);
        toast.error("Your due diligence changes couldn't be saved to the database.");
      }
      ddItemsDebounceRef.current = null;
    }, 1000);
  }, [id]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    updateNodeData(id, { ...data, title: newTitle });
    saveToBackend('title', newTitle);
  }, [id, data, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    updateNodeData(id, { ...data, description: newDescription });
    saveToBackend('description', newDescription);
  }, [id, data, updateNodeData, saveToBackend]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    GraphApiClient.deleteNode('provider' as NodeType, id)
      .then(() => {
        console.log(`Successfully deleted provider node ${id}`);
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        setEdges((edges) => {
          const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
          connectedEdges.forEach((edge) => {
            GraphApiClient.deleteEdge('provider' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
          });
          return edges.filter((edge) => edge.source !== id && edge.target !== id);
        });
      })
      .catch((error) => {
        console.error(`Failed to delete provider node ${id}:`, error);
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
    updateNodeData(id, { ...data, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, data, processedCosts, updateNodeData, saveCostsToBackend]);

  // Update an existing cost
  const updateCost = useCallback((costId: string, updates: Partial<ProviderCost>) => {
    const updatedCosts = processedCosts.map(cost => 
      cost.id === costId ? { ...cost, ...updates } : cost
    );
    
    updateNodeData(id, { ...data, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, data, processedCosts, updateNodeData, saveCostsToBackend]);

  // Remove a cost
  const removeCost = useCallback((costId: string) => {
    const updatedCosts = processedCosts.filter(cost => cost.id !== costId);
    updateNodeData(id, { ...data, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, data, processedCosts, updateNodeData, saveCostsToBackend]);

  // Add a new due diligence item
  const addDDItem = useCallback(() => {
    const newItem: DDItem = {
      id: uuidv4(),
      name: '',
      status: 'pending'
    };
    
    const updatedItems = [...processedDDItems, newItem];
    updateNodeData(id, { ...data, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, data, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Update an existing due diligence item
  const updateDDItem = useCallback((item: DDItem) => {
    const updatedItems = processedDDItems.map(i => 
      i.id === item.id ? { ...i, ...item } : i
    );
    
    updateNodeData(id, { ...data, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, data, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Remove a due diligence item
  const removeDDItem = useCallback((itemId: string) => {
    const updatedItems = processedDDItems.filter(item => item.id !== itemId);
    updateNodeData(id, { ...data, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, data, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (costsDebounceRef.current) clearTimeout(costsDebounceRef.current);
      if (ddItemsDebounceRef.current) clearTimeout(ddItemsDebounceRef.current);
      if (teamAllocationsDebounceRef.current?.timeout) clearTimeout(teamAllocationsDebounceRef.current.timeout);
    };
  }, []);

  // Return the hook API
  return {
    // State
    title: data.title || '',
    description: data.description || '',
    status,
    processedCosts,
    processedDDItems,
    processedTeamAllocations: teamAllocationsFromHook,
    connectedTeams,
    costs,
    
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
  };
} 