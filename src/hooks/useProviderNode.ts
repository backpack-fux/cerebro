"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, Edge } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFProviderNodeData, 
  ProviderCost, 
  DDItem
} from '@/services/graph/provider/provider.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { useMemberAllocationPublishing, NodeDataWithTeamAllocations } from "@/hooks/useMemberAllocationPublishing";
import { v4 as uuidv4 } from 'uuid';
import { parseDataFromBackend, parseJsonIfString } from "@/utils/utils";
import { isProviderNode } from "@/utils/type-guards";
import { TeamAllocation } from "@/utils/types/allocation";
import { useNodeObserver } from '@/hooks/useNodeObserver';
import { useDurationPublishing } from '@/utils/hooks/useDurationPublishing';
import { NodeUpdateMetadata } from '@/services/graph/observer/node-observer';

// Extend RFProviderNodeData to ensure status is of type NodeStatus
interface ExtendedRFProviderNodeData extends RFProviderNodeData {
  status?: NodeStatus;
}

/**
 * Hook for managing provider node state and operations
 * Handles provider-specific functionality like costs and due diligence items
 */
export function useProviderNode(id: string, data: ExtendedRFProviderNodeData) {
  const { getNodes, setNodes, setEdges, updateNodeData } = useReactFlow();
  
  // Initialize node observer
  const { publishManifestUpdate, subscribeBasedOnManifest } = useNodeObserver<RFProviderNodeData>(id, 'provider');
  
  // Define JSON fields that need special handling
  const jsonFields = useMemo(() => ['costs', 'ddItems', 'teamAllocations', 'memberAllocations'], []);
  
  // Add loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFProviderNodeData;
  }, [data, jsonFields]);
  
  // Validate that the node is a provider node
  if (!parsedData.title) {
    console.error('Invalid provider node data:', parsedData);
  }
  
  // State for provider data
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  const [costs, setCosts] = useState<ProviderCost[]>(
    Array.isArray(parsedData.costs) ? parsedData.costs : []
  );
  const [ddItems, setDDItems] = useState<DDItem[]>(
    Array.isArray(parsedData.ddItems) ? parsedData.ddItems : []
  );
  const [startDate, setStartDate] = useState<string>(parsedData.startDate || '');
  const [endDate, setEndDate] = useState<string>(parsedData.endDate || '');
  
  // State for editing costs
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [currentCost, setCurrentCost] = useState<ProviderCost | null>(null);
  
  // State for editing due diligence items
  const [isEditingDDItem, setIsEditingDDItem] = useState(false);
  const [currentDDItem, setCurrentDDItem] = useState<DDItem | null>(null);
  
  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cast to the extended type with additional fields
  const safeProviderData = parsedData as ExtendedRFProviderNodeData;

  // Use the standardized member allocation publishing hook
  const allocationPublishing = useMemberAllocationPublishing(
    id,
    'provider',
    safeProviderData as NodeDataWithTeamAllocations,
    publishManifestUpdate as (
      data: Partial<RFProviderNodeData>,
      fieldIds: string[],
      metadata?: Partial<NodeUpdateMetadata>
    ) => void,
    {
      fieldName: 'teamAllocations',
      debugName: 'ProviderNode'
    }
  );
  
  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, parsedData);
  
  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.processedTeamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costSummary = teamAllocationHook.costs;
  
  // Function to save node data to backend
  const saveToBackend = useCallback(async (updateData: Partial<RFProviderNodeData>) => {
    // Skip save for blacklisted nodes
    if (GraphApiClient.isNodeBlacklisted(id)) {
      console.warn(`[ProviderNode][${id}] Skipping save - node is blacklisted`);
      return;
    }
    
    try {
      console.log(`[ProviderNode][${id}] 📤 Saving to backend:`, {
        keys: Object.keys(updateData),
        hasTeamAllocations: 'teamAllocations' in updateData,
        id
      });

      // Special handling for teamAllocations
      if ('teamAllocations' in updateData && updateData.teamAllocations) {
        console.log(`[ProviderNode][${id}] ⚠️ Saving teamAllocations from saveToBackend is not recommended`, {
          teamAllocationsLength: Array.isArray(updateData.teamAllocations) ? updateData.teamAllocations.length : 'not array',
          teamAllocationsType: typeof updateData.teamAllocations
        });

        // Ensure teamAllocations is a properly formatted array
        if (Array.isArray(updateData.teamAllocations)) {
          // Validate the structure to match what the API expects
          updateData.teamAllocations = updateData.teamAllocations.map(allocation => {
            // Ensure minimum required fields with correct types
            const formatted = {
              teamId: typeof allocation.teamId === 'string' ? allocation.teamId : String(allocation.teamId || ''),
              requestedHours: typeof allocation.requestedHours === 'number' ? allocation.requestedHours : 0,
              allocatedMembers: Array.isArray(allocation.allocatedMembers) ? allocation.allocatedMembers : []
            };

            // Ensure allocatedMembers have correct format
            formatted.allocatedMembers = formatted.allocatedMembers.map(member => {
              // Use type assertion to include optional properties
              const memberWithOptionalProps = member as { memberId: string; hours: number; name?: string };
              
              return {
                memberId: typeof memberWithOptionalProps.memberId === 'string' ? memberWithOptionalProps.memberId : String(memberWithOptionalProps.memberId || ''),
                hours: typeof memberWithOptionalProps.hours === 'number' ? memberWithOptionalProps.hours : 0,
                // Only include name if it exists
                ...(memberWithOptionalProps.name ? { name: memberWithOptionalProps.name } : {})
              };
            });

            return formatted;
          });
        }
      }

      // Update node data through API
      await GraphApiClient.updateNode('provider', id, updateData);
      console.log(`[ProviderNode][${id}] ✅ Successfully saved to backend`);
    } catch (error) {
      console.error(`[ProviderNode][${id}] ❌ Error saving to backend:`, error);
    }
  }, [id]);
  
  // Use the resource allocation hook to manage resource allocations
  const resourceAllocation = useResourceAllocation(
    id,
    'provider',
    parsedData,
    teamAllocationHook,
    getNodes,
    publishManifestUpdate as (
      data: Partial<RFProviderNodeData>,
      fieldIds: string[],
      metadata?: Partial<NodeUpdateMetadata>
    ) => void
  );
  
  // Set loading to false after initial data processing
  useEffect(() => {
    // Set loading to false once initial data is processed
    setIsLoading(false);
  }, []);
  
  // Use the node status hook to manage status
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    parsedData as ExtendedRFProviderNodeData, 
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
  
  // Use the standardized duration publishing hook
  const durationPublishing = useDurationPublishing(
    id, 
    'provider', 
    parsedData, 
    publishManifestUpdate,
    { 
      fieldName: 'duration',
      debugName: 'ProviderNode'
    }
  );
  
  // Override the duration change handler
  const handleDurationChange = useCallback((value: string) => {
    durationPublishing.handleDurationChange(value, duration.handleDurationChange);
  }, [duration.handleDurationChange, durationPublishing]);
  
  // Add the custom handler to the duration object
  const enhancedDuration = useMemo(() => ({
    ...duration,
    handleDurationChange
  }), [duration, handleDurationChange]);
  
  // Save duration to backend when it changes
  useEffect(() => {
    return durationPublishing.saveToBackend();
  }, [parsedData.duration, durationPublishing]);
  
  // Add logging effect to watch for teamAllocations changes
  useEffect(() => {
    // Skip the first render
    if (!teamAllocationsFromHook || teamAllocationsFromHook.length === 0) {
      console.log(`[ProviderNode][${id}] 🔍 teamAllocations is empty or undefined, skipping save`, {
        teamAllocationsFromHook
      });
      return;
    }

    console.log(`[ProviderNode][${id}] 🔄 teamAllocations changed, will attempt to save to backend`, {
      teamAllocationsLength: teamAllocationsFromHook.length,
      teamAllocations: teamAllocationsFromHook,
      isAllocationPublishingDefined: !!allocationPublishing,
      saveToBackendAsyncExists: !!(allocationPublishing && allocationPublishing.saveToBackendAsync),
      isUpdating: allocationPublishing?.isUpdating?.current,
    });

    // Check for active updates to prevent loops
    if (allocationPublishing?.isUpdating?.current) {
      console.log(`[ProviderNode][${id}] ⚠️ Skipping save because an update is already in progress`);
      return;
    }

    // Save to backend with detailed logging
    console.log(`[ProviderNode][${id}] 📤 ATTEMPTING to save teamAllocations to backend`);
    allocationPublishing.saveToBackendAsync(teamAllocationsFromHook)
      .then(success => {
        console.log(`[ProviderNode][${id}] ${success ? '✅ Successfully saved' : '❌ Failed to save'} teamAllocations to backend`, {
          success,
          teamAllocationsLength: teamAllocationsFromHook.length
        });
      })
      .catch(error => {
        console.error(`[ProviderNode][${id}] 🚨 Error saving teamAllocations to backend:`, error);
      });

  }, [teamAllocationsFromHook, id, allocationPublishing]);
  
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
        
        setEdges((edges: Edge[]) => {
          // Find connected edges
          const connectedEdges = edges.filter((edge: Edge) => edge.source === id || edge.target === id);
          
          // Try to delete each edge from backend
          connectedEdges.forEach((edge: Edge) => {
            GraphApiClient.deleteEdge('provider' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
          });
          
          // Remove edges from React Flow
          return edges.filter((edge: Edge) => edge.source !== id && edge.target !== id);
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
  
  // Load updated data from the backend
  const refreshData = useCallback(async () => {
    try {
      // Check if this is a known blacklisted node
      if (GraphApiClient.isNodeBlacklisted(id)) {
        console.warn(`Skipping refresh for blacklisted node ${id}`);
        return false;
      }
      
      // Verify that we're working with a provider node
      const nodeFromGraph = getNodes().find(n => n.id === id);
      if (nodeFromGraph && !isProviderNode(nodeFromGraph)) {
        console.warn(`Node ${id} exists but is not a provider node. Found type: ${nodeFromGraph.type}`);
        return false;
      }
      
      console.log(`[ProviderNode][${id}] Refreshing data from backend`);
      setIsLoading(true);
      
      // Use the GraphApiClient to fetch node data
      const serverData = await GraphApiClient.getNode('provider' as NodeType, id);
      
      // Type-check and assert the shape of the returned data
      if (!serverData || !serverData.success || !serverData.data) {
        throw new Error('Invalid server data received');
      }
      
      // Create a properly typed server data object
      const typedServerData = serverData.data as {
        title?: string;
        description?: string;
        duration?: number;
        costs?: string | ProviderCost[];
        ddItems?: string | DDItem[];
        teamAllocations?: string | TeamAllocation[];
        status?: string;
        startDate?: string;
        endDate?: string;
      };
      
      // Process costs and due diligence items
      const processedCosts = parseJsonIfString<ProviderCost[]>(typedServerData.costs, []);
      const processedDDItems = parseJsonIfString<DDItem[]>(typedServerData.ddItems, []);
      const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(typedServerData.teamAllocations, []);
      
      // Update local state
      setTitle(typedServerData.title || '');
      setDescription(typedServerData.description || '');
      setCosts(processedCosts);
      setDDItems(processedDDItems);
      setStartDate(typedServerData.startDate || '');
      setEndDate(typedServerData.endDate || '');
      
      // Update node data in ReactFlow
      updateNodeData(id, {
        ...parsedData,
        title: typedServerData.title || parsedData.title,
        description: typedServerData.description || parsedData.description,
        costs: processedCosts,
        ddItems: processedDDItems,
        teamAllocations: processedTeamAllocations,
        duration: typedServerData.duration || parsedData.duration,
        startDate: typedServerData.startDate || parsedData.startDate,
        endDate: typedServerData.endDate || parsedData.endDate
      });
      
      console.log(`[ProviderNode][${id}] Successfully refreshed provider data`);
      
      if (typedServerData.teamAllocations) {
        console.log(`[ProviderNode][${id}] Updated team allocations from backend:`, processedTeamAllocations);
      }
      
      return true;
    } catch (error) {
      console.error(`[ProviderNode][${id}] Error refreshing data:`, error);
      toast.error(`Failed to refresh provider ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [id, parsedData, updateNodeData, getNodes, setTitle, setDescription, setCosts, setDDItems]);
  
  // Subscribe to updates from other nodes based on manifest
  useEffect(() => {
    if (!id) return;
    
    const { unsubscribe } = subscribeBasedOnManifest();
    
    // Listen for node data updates
    const handleNodeDataUpdated = (event: CustomEvent) => {
      const { subscriberId, publisherType, publisherId, relevantFields, data } = event.detail;
      
      if (subscriberId !== id) return;
      
      // Use the standardized shouldProcessUpdate functions
      if (!durationPublishing.shouldProcessUpdate(publisherId, relevantFields) || 
          !resourceAllocation.shouldProcessUpdate(publisherId, relevantFields)) {
        return;
      }
      
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
  }, [id, subscribeBasedOnManifest, durationPublishing, resourceAllocation]);
  
  // Create a simple boolean for saving status
  const isSavingAllocations = useMemo(() => {
    return allocationPublishing.isUpdating.current === true;
  }, [allocationPublishing.isUpdating]);
  
  // Handle start date change
  const updateStartDate = useCallback((newStartDate: string) => {
    // Update local state
    setStartDate(newStartDate);
    
    // Update ReactFlow state
    updateNodeData(id, { 
      ...parsedData, 
      startDate: newStartDate 
    });
    
    // Save to backend
    saveToBackend({ startDate: newStartDate });
  }, [id, parsedData, updateNodeData, saveToBackend]);
  
  // Handle end date change
  const updateEndDate = useCallback((newEndDate: string) => {
    // Update local state
    setEndDate(newEndDate);
    
    // Update ReactFlow state
    updateNodeData(id, { 
      ...parsedData, 
      endDate: newEndDate 
    });
    
    // Save to backend
    saveToBackend({ endDate: newEndDate });
  }, [id, parsedData, updateNodeData, saveToBackend]);
  
  // Return the provider node functionality
  return useMemo(() => {
    return {
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
      isLoading,
      isSavingAllocations,
      startDate,
      endDate,
      
      // For compatibility with provider-node.tsx
      processedCosts: costs,
      processedDDItems: ddItems,
      processedTeamAllocations: teamAllocationsFromHook,
      
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
      updateStartDate,
      updateEndDate,
      
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
      
      handleAllocationChangeLocal: resourceAllocation.handleAllocationChangeLocal,
      handleAllocationCommit: resourceAllocation.handleAllocationCommit,
      calculateMemberAllocations: resourceAllocation.calculateMemberAllocations,
      calculateCostSummary: resourceAllocation.calculateCostSummary,
      requestTeamAllocation: teamAllocationHook.requestTeamAllocation,
      
      getStatusColor,
      cycleStatus,
      
      duration: enhancedDuration,
      refreshData,
      
      // Expose allocation publishing for loading indicator 
      allocationPublishing
    };
  }, [
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
    isLoading,
    isSavingAllocations,
    startDate,
    endDate,
    
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
    updateStartDate,
    updateEndDate,
    
    resourceAllocation.handleAllocationChangeLocal,
    resourceAllocation.handleAllocationCommit,
    resourceAllocation.calculateMemberAllocations,
    resourceAllocation.calculateCostSummary,
    teamAllocationHook.requestTeamAllocation,
    
    getStatusColor,
    cycleStatus,
    
    enhancedDuration,
    refreshData,
    
    allocationPublishing
  ]);
} 