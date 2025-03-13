"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFFeatureNodeData, 
  BuildType
} from '@/services/graph/feature/feature.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { prepareDataForBackend, parseDataFromBackend, parseJsonIfString } from "@/lib/utils";
import { isFeatureNode } from "@/utils/type-guards";
import { TeamAllocation } from "@/utils/types/allocation";
import { format } from 'date-fns';
import { convertToDays, calculateEndDate } from '@/utils/time/duration';
import { TimeUnit } from '@/types/common';
import { isMemberNode } from '@/utils/node-utils';

/**
 * Hook for managing feature node state and operations
 * Separates domain logic from React Flow component state
 */
export function useFeatureNode(id: string, data: RFFeatureNodeData) {
  const { getNodes, setNodes, setEdges, updateNodeData } = useReactFlow();
  const teamAllocationHook = useTeamAllocation(id, data);
  const { processedTeamAllocations, connectedTeams, costs } = teamAllocationHook;
  
  // Track if we've loaded data from the server
  const initialFetchCompletedRef = useRef(false);
  const isInitializedRef = useRef(false);
  
  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const buildTypeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const durationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Define JSON fields that need special handling
  const jsonFields = ['teamAllocations', 'memberAllocations', 'teamMembers', 'availableBandwidth'];
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFFeatureNodeData;
  }, [data, jsonFields]);
  
  // State for the feature node
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  const [buildType, setBuildType] = useState<BuildType>(parsedData.buildType || 'internal');
  const [isLoading, setIsLoading] = useState(false);
  
  // Ensure valid build type
  const ensureValidBuildType = (type: string | undefined): BuildType => {
    // Default to 'internal' if type is undefined, empty, or not one of the valid options
    const validTypes: BuildType[] = ['internal', 'external'];
    return (type && validTypes.includes(type as BuildType)) ? (type as BuildType) : 'internal';
  };

  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFFeatureNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('feature' as NodeType, id, apiData);
      console.log(`Updated feature node ${id}:`, updates);
    } catch (error) {
      console.error(`Failed to update feature node ${id}:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, jsonFields]);
  
  // Reset the initialFetchCompletedRef when the ID changes
  useEffect(() => {
    initialFetchCompletedRef.current = false;
  }, [id]);
  
  // Function to refresh data from the server
  const refreshData = useCallback(async () => {
    if (GraphApiClient.isNodeBlacklisted(id)) return;
    
    try {
      setIsLoading(true);
      
      const serverData = await GraphApiClient.getNode('feature' as NodeType, id);
      
      // Verify that we're working with a feature node in case the API returns a different type
      const nodeFromGraph = getNodes().find(n => n.id === id);
      if (nodeFromGraph && !isFeatureNode(nodeFromGraph)) {
        console.warn(`Node ${id} exists but is not a feature node. Type: ${nodeFromGraph.type}`);
      }
      
      // Process team allocations using parseJsonIfString utility
      const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(serverData.data.teamAllocations, []);
      
      // Ensure buildType is valid
      const validBuildType = ensureValidBuildType(serverData.data.buildType);
      
      // Update local state with all server data
      setTitle(serverData.data.title || '');
      setDescription(serverData.data.description || '');
      setBuildType(validBuildType);
      
      // Update node data in ReactFlow
      updateNodeData(id, {
        ...parsedData,
        title: serverData.data.title || parsedData.title,
        description: serverData.data.description || parsedData.description,
        buildType: validBuildType,
        teamAllocations: processedTeamAllocations,
        startDate: serverData.data.startDate,
        endDate: serverData.data.endDate,
        duration: serverData.data.duration
      });
      
    } catch (error) {
      console.error(`Error refreshing node data for ${id}:`, error);
      toast.error(`Failed to refresh feature ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [id, parsedData, updateNodeData, ensureValidBuildType, getNodes]);
  
  // Use effect to initialize data from server
  useEffect(() => {
    if (isLoading || initialFetchCompletedRef.current) return;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        if (GraphApiClient.isNodeBlacklisted(id)) {
          initialFetchCompletedRef.current = true;
          return;
        }
        
        try {
          const serverData = await GraphApiClient.getNode('feature' as NodeType, id);
          
          // Process team allocations using parseJsonIfString utility
          const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(serverData.data.teamAllocations, []);
          
          // Ensure buildType is valid
          const validBuildType = ensureValidBuildType(serverData.data.buildType);
          
          // Update local state with all server data
          setTitle(serverData.data.title || '');
          setDescription(serverData.data.description || '');
          setBuildType(validBuildType);
          
          // Update node data in ReactFlow
          updateNodeData(id, {
            ...parsedData,
            title: serverData.data.title || parsedData.title,
            description: serverData.data.description || parsedData.description,
            buildType: validBuildType,
            teamAllocations: processedTeamAllocations,
            startDate: serverData.data.startDate,
            endDate: serverData.data.endDate,
            duration: serverData.data.duration
          });
          
        } catch (error) {
          console.error(`Error fetching node data for ${id}:`, error);
          
          // If the node doesn't exist, we should still mark it as initialized
          if (error instanceof Error && error.message.includes('404')) {
            console.warn(`Node ${id} not found, marking as initialized anyway`);
          } else {
            toast.error(`Failed to load feature ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } finally {
        setIsLoading(false);
        initialFetchCompletedRef.current = true;
      }
    };
    
    fetchData();
  }, [id, parsedData, updateNodeData, isLoading]);
  
  // Update local state when data changes from the props
  useEffect(() => {
    // Only update if we're not loading and the initial fetch is complete
    if (!isLoading && initialFetchCompletedRef.current) {
      // Check if the data has changed to avoid unnecessary updates
      if (title !== parsedData.title) {
        setTitle(parsedData.title || '');
      }
      
      if (description !== parsedData.description) {
        setDescription(parsedData.description || '');
      }
      
      const validBuildType = ensureValidBuildType(parsedData.buildType);
      if (buildType !== validBuildType) {
        setBuildType(validBuildType);
      }
    }
  }, [parsedData.title, parsedData.description, parsedData.buildType, isLoading, title, description, buildType]);
  
  // Save team allocations to backend
  const saveTeamAllocationsToBackend = useCallback(async (allocations: TeamAllocation[]) => {
    try {
      await GraphApiClient.updateNode('feature' as NodeType, id, {
        teamAllocations: allocations
      });
    } catch (error) {
      console.error('Failed to save team allocations to backend:', error);
    }
  }, [id]);

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
  
  // Use the duration input hook to manage duration
  const duration = useDurationInput(
    id, 
    parsedData, 
    updateNodeData,
    {
      maxDays: 180,
      label: 'Time to Complete',
      fieldName: 'duration',
      tip: 'Use "d" for days or "w" for weeks.',
    }
  );

  // Extract functions from the duration hook
  const { handleDurationChange } = duration;

  // Handle time unit change
  const handleTimeUnitChange = useCallback((newTimeUnit: string) => {
    // Cast to TimeUnit for type safety
    const validTimeUnit = newTimeUnit as any;
    updateNodeData(id, { ...parsedData, timeUnit: validTimeUnit });
    saveToBackend({ timeUnit: validTimeUnit });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle status change - use the handleStatusChange from useNodeStatus
  const handleStatusChange = useCallback((newStatus: NodeStatus) => {
    // Update node data with the new status
    updateNodeData(id, { ...parsedData, status: newStatus });
    // Save to backend
    saveToBackend({ status: newStatus });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Extract functions from the resource allocation hook
  const { 
    handleAllocationChangeLocal, 
    handleAllocationCommit,
    calculateMemberAllocations,
    calculateCostSummary
  } = resourceAllocation;

  // Request team allocation - delegate to the team allocation hook
  const requestTeamAllocation = useCallback((
    teamId: string, 
    requestedHours: number, 
    memberData: any[] = []
  ) => {
    return teamAllocationHook.requestTeamAllocation(teamId, requestedHours, memberData);
  }, [teamAllocationHook]);

  // Extract timeUnit from parsed data with default
  const timeUnit = (parsedData.timeUnit as TimeUnit) || 'days';

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state first
    setTitle(newTitle);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, title: newTitle });
    
    // Clear existing timeout
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    // Debounce the save to backend
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
    
    // Clear existing timeout
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    // Debounce the save to backend
    descriptionDebounceRef.current = setTimeout(() => {
      saveToBackend({ description: newDescription });
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle build type change
  const handleBuildTypeChange = useCallback((newBuildType: BuildType) => {
    // Ensure the new build type is valid
    const validBuildType = ensureValidBuildType(newBuildType);
    
    // Check if value actually changed to prevent unnecessary updates
    if (buildType === validBuildType) {
      return;
    }
    
    // Set initialized flag to prevent redundant default setting
    isInitializedRef.current = true;
    
    // Update local state first
    setBuildType(validBuildType);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, buildType: validBuildType });
    
    // Clear existing timeout
    if (buildTypeDebounceRef.current) clearTimeout(buildTypeDebounceRef.current);
    
    // Debounce the save to backend
    buildTypeDebounceRef.current = setTimeout(() => {
      saveToBackend({ buildType: validBuildType });
      buildTypeDebounceRef.current = null;
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend, buildType, ensureValidBuildType]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    GraphApiClient.deleteNode('feature' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        setEdges((edges) => {
          const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
          connectedEdges.forEach((edge) => {
            GraphApiClient.deleteEdge('feature' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
          });
          return edges.filter((edge) => edge.source !== id && edge.target !== id);
        });
      })
      .catch((error) => {
        console.error(`Failed to delete feature node ${id}:`, error);
        toast.error("The feature couldn't be deleted from the database.");
      });
  }, [id, setNodes, setEdges]);

  // Save duration to backend when it changes
  useEffect(() => {
    if (parsedData.duration !== undefined) {
      // Clear existing timeout
      if (durationDebounceRef.current) clearTimeout(durationDebounceRef.current);
      
      // Debounce the save to backend
      durationDebounceRef.current = setTimeout(() => {
        saveToBackend({ duration: parsedData.duration });
        durationDebounceRef.current = null;
      }, 1000);
    }
    
    // Cleanup the timeout when the component unmounts or when duration changes again
    return () => {
      if (durationDebounceRef.current) clearTimeout(durationDebounceRef.current);
    };
  }, [parsedData.duration, saveToBackend]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (buildTypeDebounceRef.current) clearTimeout(buildTypeDebounceRef.current);
      if (durationDebounceRef.current) clearTimeout(durationDebounceRef.current);
    };
  }, []);

  // Add fields for startDate and endDate to the feature node data
  const startDate = useMemo(() => {
    if (parsedData.startDate) return parsedData.startDate as string;
    const now = new Date();
    return format(now, 'yyyy-MM-dd');
  }, [parsedData.startDate]);

  const endDate = useMemo(() => {
    if (parsedData.endDate) return parsedData.endDate as string;
    
    // Calculate end date based on duration and timeUnit
    const currentTimeUnit = (parsedData.timeUnit as TimeUnit) || 'days';
    const durationValue = Number(duration.value) || 30;
    
    // Convert to days based on time unit
    const durationDays = convertToDays(durationValue, currentTimeUnit);
    
    // Calculate end date
    const startDateObj = new Date();
    const endDateObj = calculateEndDate(startDateObj, durationDays);
    return format(endDateObj, 'yyyy-MM-dd');
  }, [parsedData.endDate, duration.value, parsedData.timeUnit]);

  // Add date change handlers
  const handleStartDateChange = useCallback((date: string) => {
    saveToBackend({ startDate: date });
  }, [saveToBackend]);

  const handleEndDateChange = useCallback((date: string) => {
    saveToBackend({ endDate: date });
  }, [saveToBackend]);

  // Update member names in team allocations when member nodes change
  useEffect(() => {
    const nodes = getNodes();
    let hasUpdates = false;
    
    // Create updated team allocations
    const updatedTeamAllocations = processedTeamAllocations.map((teamAllocation: TeamAllocation) => {
      const updatedMembers = teamAllocation.allocatedMembers.map(member => {
        // Find the member node
        const memberNode = nodes.find(n => n.id === member.memberId && isMemberNode(n));
        if (!memberNode || memberNode.data.title === member.name) {
          return member;
        }
        
        // Update member name if it has changed
        hasUpdates = true;
        return {
          ...member,
          name: memberNode.data.title
        };
      });
      
      return {
        ...teamAllocation,
        allocatedMembers: updatedMembers
      };
    });
    
    // Only update if names have changed
    if (hasUpdates) {
      updateNodeData(id, {
        ...parsedData,
        teamAllocations: updatedTeamAllocations
      });
    }
  }, [id, parsedData, getNodes, updateNodeData, processedTeamAllocations]);

  // Return the hook API
  return useMemo(() => ({
    // State
    title,
    description,
    buildType,
    status,
    isLoading,
    processedTeamAllocations,
    connectedTeams,
    costs,
    startDate,
    endDate,
    
    // Handlers
    handleTitleChange,
    handleDescriptionChange,
    handleBuildTypeChange,
    handleDurationChange,
    handleTimeUnitChange,
    handleStatusChange,
    cycleStatus,
    handleDelete,
    requestTeamAllocation,
    handleAllocationChangeLocal,
    handleAllocationCommit,
    saveToBackend,
    handleStartDateChange,
    handleEndDateChange,
    refreshData,
    
    // Helper functions
    getStatusColor,
    calculateMemberAllocations,
    calculateCostSummary,
    
    // Helper components
    duration: {
      value: duration.value,
      timeUnit: parsedData.timeUnit,
      displayValue: duration.displayValue,
      handleDurationChange: duration.handleDurationChange
    }
  }), [
    title, description, buildType, status, processedTeamAllocations, isLoading, saveToBackend,
    handleTitleChange, handleDescriptionChange, handleBuildTypeChange, handleStatusChange,
    handleDurationChange, handleTimeUnitChange, cycleStatus, handleDelete, requestTeamAllocation,
    handleAllocationChangeLocal, handleAllocationCommit,
    duration, timeUnit, startDate, endDate, handleStartDateChange, handleEndDateChange,
    refreshData, getStatusColor, calculateMemberAllocations, calculateCostSummary
  ]);
} 