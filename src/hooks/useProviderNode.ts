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
import { NodeStatus } from "@/services/graph/shared/shared.types";
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for managing provider node state and operations
 * Separates domain logic from React Flow component state
 */
export function useProviderNode(id: string, data: RFProviderNodeData) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  
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
  
  // Use the team allocation hook for team-related operations
  const {
    connectedTeams,
    requestTeamAllocation,
    removeMemberAllocation,
    updateMemberAllocation,
    costs,
    CostSummary
  } = useTeamAllocation(id, data);

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

  // Save team allocations to backend with debouncing
  const saveTeamAllocationsToBackend = useCallback(async (teamAllocations: TeamAllocation[]) => {
    if (!teamAllocationsDebounceRef.current) {
      teamAllocationsDebounceRef.current = { timeout: null };
    }
    
    if (teamAllocationsDebounceRef.current.timeout) {
      clearTimeout(teamAllocationsDebounceRef.current.timeout);
    }
    
    if (!Array.isArray(teamAllocations)) {
      console.warn('Cannot save teamAllocations: not an array', teamAllocations);
      return;
    }
    
    teamAllocationsDebounceRef.current.timeout = setTimeout(async () => {
      console.log('💾 Saving teamAllocations to backend:', teamAllocations);
      
      // Update the node data with the array version first
      updateNodeData(id, { ...data, teamAllocations });
      
      // Then save to backend
      await saveToBackend('teamAllocations', teamAllocations);
      
      teamAllocationsDebounceRef.current.timeout = null;
    }, 1000);
  }, [id, data, updateNodeData, saveToBackend]);

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

  // Cost management functions
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

  const updateCost = useCallback((costId: string, updates: Partial<ProviderCost>) => {
    const updatedCosts = processedCosts.map(cost => 
      cost.id === costId ? { ...cost, ...updates } : cost
    );
    
    updateNodeData(id, { ...data, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, data, processedCosts, updateNodeData, saveCostsToBackend]);

  const removeCost = useCallback((costId: string) => {
    const updatedCosts = processedCosts.filter(cost => cost.id !== costId);
    updateNodeData(id, { ...data, costs: updatedCosts });
    saveCostsToBackend(updatedCosts);
  }, [id, data, processedCosts, updateNodeData, saveCostsToBackend]);

  // DD Items management functions
  const addDDItem = useCallback(() => {
    const newItem: DDItem = {
      id: uuidv4(),
      name: 'New Item',
      status: 'pending'
    };
    
    const updatedItems = [...processedDDItems, newItem];
    updateNodeData(id, { ...data, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, data, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  const updateDDItem = useCallback((item: DDItem) => {
    const updatedItems = processedDDItems.map(i => 
      i.id === item.id ? item : i
    );
    
    updateNodeData(id, { ...data, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, data, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  const removeDDItem = useCallback((itemId: string) => {
    const updatedItems = processedDDItems.filter(item => item.id !== itemId);
    updateNodeData(id, { ...data, ddItems: updatedItems });
    saveDDItemsToBackend(updatedItems);
  }, [id, data, processedDDItems, updateNodeData, saveDDItemsToBackend]);

  // Ensure data structures are always arrays
  useEffect(() => {
    const updates: Partial<RFProviderNodeData> = {};
    let needsUpdate = false;
    
    // Check if costs is not an array
    if (data.costs !== undefined && !Array.isArray(data.costs)) {
      updates.costs = [];
      needsUpdate = true;
    }
    
    // Check if ddItems is not an array
    if (data.ddItems !== undefined && !Array.isArray(data.ddItems)) {
      updates.ddItems = [];
      needsUpdate = true;
    }
    
    // Check if teamAllocations is not an array
    if (data.teamAllocations !== undefined && !Array.isArray(data.teamAllocations)) {
      if (typeof data.teamAllocations === 'string') {
        try {
          const parsed = JSON.parse(data.teamAllocations);
          if (Array.isArray(parsed)) {
            updates.teamAllocations = parsed;
          } else {
            updates.teamAllocations = [];
          }
        } catch (e) {
          updates.teamAllocations = [];
        }
      } else {
        updates.teamAllocations = [];
      }
      needsUpdate = true;
    }
    
    // Update the node data if needed
    if (needsUpdate) {
      updateNodeData(id, { ...data, ...updates });
    }
  }, [id, data, updateNodeData]);

  // Save duration to backend when it changes
  useEffect(() => {
    if (data.duration !== undefined) {
      saveToBackend('duration', data.duration);
    }
  }, [data.duration, saveToBackend]);
  
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

  // Calculate team allocations for UI
  const teamAllocations = useMemo(() => {
    return connectedTeams.map(team => {
      const allocation = processedTeamAllocations.find(a => a.teamId === team.teamId);
      return {
        ...team,
        requestedHours: allocation?.requestedHours || 0,
        allocatedMembers: allocation?.allocatedMembers || []
      };
    });
  }, [connectedTeams, processedTeamAllocations]);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    title: data.title,
    description: data.description || '',
    duration,
    status,
    getStatusColor,
    cycleStatus,
    teamAllocations,
    connectedTeams,
    processedTeamAllocations,
    processedCosts,
    processedDDItems,
    costs,
    CostSummary,
    
    // Actions
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    addCost,
    updateCost,
    removeCost,
    addDDItem,
    updateDDItem,
    removeDDItem,
    requestTeamAllocation,
    removeMemberAllocation,
    updateMemberAllocation,
    saveTeamAllocationsToBackend,
    saveCostsToBackend,
    saveDDItemsToBackend
  }), [
    data.title,
    data.description,
    duration,
    status,
    getStatusColor,
    cycleStatus,
    teamAllocations,
    connectedTeams,
    processedTeamAllocations,
    processedCosts,
    processedDDItems,
    costs,
    CostSummary,
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    addCost,
    updateCost,
    removeCost,
    addDDItem,
    updateDDItem,
    removeDDItem,
    requestTeamAllocation,
    removeMemberAllocation,
    updateMemberAllocation,
    saveTeamAllocationsToBackend,
    saveCostsToBackend,
    saveDDItemsToBackend
  ]);
} 