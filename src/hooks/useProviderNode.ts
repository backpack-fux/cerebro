"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFProviderNodeData, 
  ProviderCost, 
  DDItem
} from '@/services/graph/provider/provider.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { v4 as uuidv4 } from 'uuid';
import { prepareDataForBackend, parseDataFromBackend, parseJsonIfString } from "@/utils/utils";
import { isProviderNode } from "@/utils/type-guards";
import { TeamAllocation } from "@/utils/types/allocation";
import { calculateCalendarDuration } from "@/utils/time/calendar";
import { useNodeObserver } from '@/hooks/useNodeObserver';

/**
 * Hook for managing provider node state and operations
 * Handles provider-specific functionality like costs and due diligence items
 */
export function useProviderNode(id: string, data: RFProviderNodeData) {
  const { getNodes, setNodes, getEdges, setEdges, updateNodeData } = useReactFlow();
  
  // Initialize node observer
  const { publishUpdate, publishManifestUpdate, subscribeBasedOnManifest } = useNodeObserver<RFProviderNodeData>(id, 'provider');
  
  // Define JSON fields that need special handling
  const jsonFields = ['costs', 'ddItems', 'teamAllocations', 'memberAllocations'];
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFProviderNodeData;
  }, [data, jsonFields]);
  
  // Validate that the node is a provider node
  useEffect(() => {
    const nodeFromGraph = getNodes().find(n => n.id === id);
    if (nodeFromGraph && !isProviderNode(nodeFromGraph)) {
      console.warn(`Node ${id} exists but is not a provider node. Found type: ${nodeFromGraph.type}`);
    }
  }, [id, getNodes]);
  
  // State for provider data
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  const [costs, setCosts] = useState<ProviderCost[]>(
    Array.isArray(parsedData.costs) ? parsedData.costs : []
  );
  const [ddItems, setDDItems] = useState<DDItem[]>(
    Array.isArray(parsedData.ddItems) ? parsedData.ddItems : []
  );
  
  // State for editing costs
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [currentCost, setCurrentCost] = useState<ProviderCost | null>(null);
  
  // State for editing due diligence items
  const [isEditingDDItem, setIsEditingDDItem] = useState(false);
  const [currentDDItem, setCurrentDDItem] = useState<DDItem | null>(null);
  
  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFProviderNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('provider' as NodeType, id, apiData);
      
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
      console.error('Error saving provider node:', error);
      toast.error('Failed to save provider data');
      return false;
    }
  }, [id, jsonFields, updateNodeData, parsedData, publishManifestUpdate]);
  
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
  
  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, parsedData);
  
  // Add the saveTeamAllocationsToBackend function to the teamAllocationHook
  (teamAllocationHook as any).saveTeamAllocationsToBackend = saveTeamAllocationsToBackend;
  
  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.processedTeamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costSummary = teamAllocationHook.costs;
  
  // Use the resource allocation hook to manage resource allocations
  const resourceAllocation = useResourceAllocation(parsedData, teamAllocationHook, getNodes);
  
  // Use the node status hook to manage status
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    parsedData, 
    updateNodeData, 
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );
  
  // Use the duration input hook for duration-related operations
  const duration = useDurationInput(id, parsedData, updateNodeData, {
    maxDays: 365,
    label: "Contract Duration",
    fieldName: "duration",
    tip: "Duration in days of the provider contract"
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
  
  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state first
    setTitle(newTitle);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, title: newTitle });
    
    // Debounce the save to backend
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(() => {
      saveToBackend({ title: newTitle });
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend]);
  
  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Update local state first
    setDescription(newDescription);
    
    // Then update ReactFlow state 
    updateNodeData(id, { ...parsedData, description: newDescription });
    
    // Debounce the save to backend
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(() => {
      saveToBackend({ description: newDescription });
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend]);
  
  // Handle costs
  const addCost = useCallback(() => {
    const newCost: ProviderCost = {
      id: `cost-${uuidv4()}`,
      name: '',
      costType: 'fixed',
      details: {
        type: 'fixed',
        amount: 0,
        frequency: 'monthly'
      }
    };
    
    setCurrentCost(newCost);
    setIsEditingCost(true);
  }, []);
  
  const editCost = useCallback((cost: ProviderCost) => {
    setCurrentCost(cost);
    setIsEditingCost(true);
  }, []);
  
  const saveCost = useCallback((cost: ProviderCost) => {
    const updatedCosts = [...costs];
    const existingIndex = updatedCosts.findIndex(c => c.id === cost.id);
    
    if (existingIndex >= 0) {
      updatedCosts[existingIndex] = cost;
    } else {
      updatedCosts.push(cost);
    }
    
    setCosts(updatedCosts);
    updateNodeData(id, { ...parsedData, costs: updatedCosts });
    saveToBackend({ costs: updatedCosts });
    
    setCurrentCost(null);
    setIsEditingCost(false);
  }, [costs, id, parsedData, updateNodeData, saveToBackend]);
  
  const deleteCost = useCallback((costId: string) => {
    const updatedCosts = costs.filter(cost => cost.id !== costId);
    setCosts(updatedCosts);
    updateNodeData(id, { ...parsedData, costs: updatedCosts });
    saveToBackend({ costs: updatedCosts });
  }, [costs, id, parsedData, updateNodeData, saveToBackend]);
  
  // Handle due diligence items
  const addDDItem = useCallback(() => {
    const newDDItem: DDItem = {
      id: `dd-${uuidv4()}`,
      name: '',
      status: 'pending',
      notes: ''
    };
    
    setCurrentDDItem(newDDItem);
    setIsEditingDDItem(true);
  }, []);
  
  const editDDItem = useCallback((ddItem: DDItem) => {
    setCurrentDDItem(ddItem);
    setIsEditingDDItem(true);
  }, []);
  
  const saveDDItem = useCallback((ddItem: DDItem) => {
    const updatedDDItems = [...ddItems];
    const existingIndex = updatedDDItems.findIndex(item => item.id === ddItem.id);
    
    if (existingIndex >= 0) {
      updatedDDItems[existingIndex] = ddItem;
    } else {
      updatedDDItems.push(ddItem);
    }
    
    setDDItems(updatedDDItems);
    updateNodeData(id, { ...parsedData, ddItems: updatedDDItems });
    saveToBackend({ ddItems: updatedDDItems });
    
    setCurrentDDItem(null);
    setIsEditingDDItem(false);
  }, [ddItems, id, parsedData, updateNodeData, saveToBackend]);
  
  const deleteDDItem = useCallback((ddItemId: string) => {
    const updatedDDItems = ddItems.filter(item => item.id !== ddItemId);
    setDDItems(updatedDDItems);
    updateNodeData(id, { ...parsedData, ddItems: updatedDDItems });
    saveToBackend({ ddItems: updatedDDItems });
  }, [ddItems, id, parsedData, updateNodeData, saveToBackend]);
  
  // Handle node deletion
  const handleDelete = useCallback(() => {
    GraphApiClient.deleteNode('provider' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        setEdges((edges) => {
          // Find connected edges
          const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
          
          // Try to delete each edge from backend
          connectedEdges.forEach((edge) => {
            GraphApiClient.deleteEdge('provider' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
          });
          
          // Remove edges from React Flow
          return edges.filter((edge) => edge.source !== id && edge.target !== id);
        });
        
        toast.success("Provider successfully deleted");
      })
      .catch((error) => {
        console.error(`Failed to delete provider node ${id}:`, error);
        toast.error("Delete Failed: Failed to delete the provider node from the server.");
      });
  }, [id, setNodes, setEdges]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    };
  }, []);
  
  // Function to refresh data from the server
  const refreshData = useCallback(async () => {
    try {
      // Check if this is a known blacklisted node
      if (GraphApiClient.isNodeBlacklisted(id)) {
        console.warn(`Skipping refresh for blacklisted node ${id}`);
        return;
      }
      
      // Verify that we're working with a provider node
      const nodeFromGraph = getNodes().find(n => n.id === id);
      if (nodeFromGraph && !isProviderNode(nodeFromGraph)) {
        console.warn(`Node ${id} exists but is not a provider node. Found type: ${nodeFromGraph.type}`);
        return;
      }
      
      // Use the GraphApiClient to fetch node data
      const serverData = await GraphApiClient.getNode('provider' as NodeType, id);
      
      // Process costs and due diligence items
      const processedCosts = parseJsonIfString<ProviderCost[]>(serverData.data.costs, []);
      const processedDDItems = parseJsonIfString<DDItem[]>(serverData.data.ddItems, []);
      const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(serverData.data.teamAllocations, []);
      
      // Update local state
      setTitle(serverData.data.title || '');
      setDescription(serverData.data.description || '');
      setCosts(processedCosts);
      setDDItems(processedDDItems);
      
      // Update node data in ReactFlow
      updateNodeData(id, {
        ...parsedData,
        title: serverData.data.title || parsedData.title,
        description: serverData.data.description || parsedData.description,
        costs: processedCosts,
        ddItems: processedDDItems,
        teamAllocations: processedTeamAllocations,
        duration: serverData.data.duration || parsedData.duration
      });
      
      console.log(`Successfully refreshed provider data for ${id}`);
    } catch (error) {
      console.error(`Error refreshing provider node data for ${id}:`, error);
      toast.error(`Failed to refresh provider ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, parsedData, updateNodeData, getNodes]);
  
  // Subscribe to updates from other nodes based on manifest
  useEffect(() => {
    if (!id) return;
    
    const { unsubscribe } = subscribeBasedOnManifest();
    
    // Listen for node data updates
    const handleNodeDataUpdated = (event: CustomEvent) => {
      const { subscriberId, publisherType, publisherId, relevantFields, data } = event.detail;
      
      if (subscriberId !== id) return;
      
      console.log(`Provider node ${id} received update from ${publisherType} ${publisherId}:`, {
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
  
  // Return the hook API
  return useMemo(() => ({
    // State
    title,
    description,
    costs,
    ddItems,
    isEditingCost,
    currentCost,
    isEditingDDItem,
    currentDDItem,
    status,
    processedTeamAllocations: teamAllocationsFromHook,
    connectedTeams,
    costSummary,
    
    // For compatibility with provider-node.tsx
    processedCosts: costs,
    processedDDItems: ddItems,
    
    // Handlers
    handleTitleChange,
    handleDescriptionChange,
    addCost,
    editCost,
    saveCost,
    deleteCost,
    addDDItem,
    editDDItem,
    saveDDItem,
    deleteDDItem,
    handleDelete,
    
    // For compatibility with provider-node.tsx
    updateCost: (costId: string, updates: Partial<ProviderCost>) => {
      const cost = costs.find(c => c.id === costId);
      if (cost) {
        saveCost({ ...cost, ...updates });
      }
    },
    removeCost: (costId: string) => deleteCost(costId),
    updateDDItem: saveDDItem,
    removeDDItem: deleteDDItem,
    
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
    
    // New refreshData function
    refreshData,
  }), [
    title,
    description,
    costs,
    ddItems,
    isEditingCost,
    currentCost,
    isEditingDDItem,
    currentDDItem,
    status,
    teamAllocationsFromHook,
    connectedTeams,
    costSummary,
    handleTitleChange,
    handleDescriptionChange,
    addCost,
    editCost,
    saveCost,
    deleteCost,
    addDDItem,
    editDDItem,
    saveDDItem,
    deleteDDItem,
    handleDelete,
    resourceAllocation.handleAllocationChangeLocal,
    resourceAllocation.handleAllocationCommit,
    resourceAllocation.calculateMemberAllocations,
    resourceAllocation.calculateCostSummary,
    teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    getStatusColor,
    cycleStatus,
    duration,
    refreshData,
  ]);
} 