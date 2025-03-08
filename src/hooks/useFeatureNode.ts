"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFFeatureNodeData, 
  TeamAllocation,
  BuildType
} from '@/services/graph/feature/feature.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { prepareDataForBackend, parseDataFromBackend } from "@/lib/utils";

/**
 * Hook for managing feature node state and operations
 * Separates domain logic from React Flow component state
 */
export function useFeatureNode(id: string, data: RFFeatureNodeData) {
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();
  
  // Track if we've loaded data from the server
  const initialFetchCompletedRef = useRef(false);
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });
  const isInitializedRef = useRef(false);
  
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
  const [teamAllocations, setTeamAllocations] = useState<TeamAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ensure valid build type
  const ensureValidBuildType = (type: string | undefined): BuildType => {
    // Default to 'internal' if type is undefined, empty, or not one of the valid options
    const validTypes: BuildType[] = ['internal', 'external'];
    return (type && validTypes.includes(type as BuildType)) ? (type as BuildType) : 'internal';
  };

  // Update node function - centralizes node state updates
  const updateNodeData = useCallback((nodeId: string, newData: Partial<RFFeatureNodeData>) => {
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData }
          };
        }
        return node;
      })
    );
  }, [setNodes]);
  
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
    console.log(`🔄 Manually refreshing feature data for ${id}`);
    
    try {
      setIsLoading(true);
      
      // Check if this is a known blacklisted node
      if (GraphApiClient.isNodeBlacklisted(id)) {
        console.warn(`🚫 Skipping refresh for blacklisted node ${id}`);
        return;
      }
      
      // Use the GraphApiClient to fetch node data
      const serverData = await GraphApiClient.getNode('feature' as NodeType, id);
      
      console.log(`🚀 Server returned refreshed data for ${id}:`, serverData);
      
      // Process team allocations
      let processedTeamAllocations: TeamAllocation[] = [];
      
      console.log('🔍 Processing teamAllocations:', {
        teamAllocations: serverData.data.teamAllocations,
        type: typeof serverData.data.teamAllocations,
        isArray: Array.isArray(serverData.data.teamAllocations)
      });
      
      if (Array.isArray(serverData.data.teamAllocations)) {
        processedTeamAllocations = serverData.data.teamAllocations;
        console.log('🚀 Server returned teamAllocations as array:', processedTeamAllocations);
      } else if (typeof serverData.data.teamAllocations === 'string') {
        try {
          processedTeamAllocations = JSON.parse(serverData.data.teamAllocations);
          console.log('🚀 Parsed teamAllocations from string:', processedTeamAllocations);
        } catch (e) {
          console.error('❌ Failed to parse teamAllocations:', e);
          processedTeamAllocations = [];
        }
      }
      
      console.log('✅ Final processed teamAllocations:', processedTeamAllocations);
      
      // Ensure buildType is valid
      const buildType = ensureValidBuildType(serverData.data.buildType);
      
      // Update local state with all server data
      setTitle(serverData.data.title || '');
      setDescription(serverData.data.description || '');
      setBuildType(buildType);
      setTeamAllocations(processedTeamAllocations);
      
      // Update node data in ReactFlow
      updateNodeData(id, {
        ...parsedData,
        title: serverData.data.title || parsedData.title,
        description: serverData.data.description || parsedData.description,
        buildType,
        teamAllocations: processedTeamAllocations,
        startDate: serverData.data.startDate,
        endDate: serverData.data.endDate,
        duration: serverData.data.duration
      });
      
      console.log('✅ Successfully refreshed feature data with teamAllocations:', processedTeamAllocations);
      
    } catch (error) {
      console.error(`❌ Error refreshing node data for ${id}:`, error);
      toast.error(`Failed to refresh feature ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [id, parsedData, updateNodeData, ensureValidBuildType]);
  
  // Use effect to initialize data from server
  useEffect(() => {
    if (isLoading || initialFetchCompletedRef.current) return;
    
    console.log(`🔄 Fetching feature data for ${id}`);
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Check if this is a known blacklisted node
        if (GraphApiClient.isNodeBlacklisted(id)) {
          console.warn(`🚫 Skipping fetch for blacklisted node ${id}`);
          setIsLoading(false);
          initialFetchCompletedRef.current = true;
          return;
        }
        
        // Use the GraphApiClient to fetch node data instead of direct fetch call
        try {
          const serverData = await GraphApiClient.getNode('feature' as NodeType, id);
          
          console.log(`🚀 Server returned initial data for ${id}:`, serverData);
          
          // Process team allocations
          let processedTeamAllocations: TeamAllocation[] = [];
          
          console.log('🔍 Initial processing of teamAllocations:', {
            teamAllocations: serverData.data.teamAllocations,
            type: typeof serverData.data.teamAllocations,
            isArray: Array.isArray(serverData.data.teamAllocations)
          });
          
          if (Array.isArray(serverData.data.teamAllocations)) {
            processedTeamAllocations = serverData.data.teamAllocations;
            console.log('🚀 Server returned teamAllocations as array:', processedTeamAllocations);
          } else if (typeof serverData.data.teamAllocations === 'string') {
            try {
              processedTeamAllocations = JSON.parse(serverData.data.teamAllocations);
              console.log('🚀 Parsed teamAllocations from string:', processedTeamAllocations);
            } catch (e) {
              console.error('❌ Failed to parse teamAllocations:', e);
              processedTeamAllocations = [];
            }
          }
          
          console.log('✅ Final initial processed teamAllocations:', processedTeamAllocations);
          
          // Ensure buildType is valid
          const buildType = ensureValidBuildType(serverData.data.buildType);
          
          // Update local state with all server data
          setTitle(serverData.data.title || '');
          setDescription(serverData.data.description || '');
          setBuildType(buildType);
          setTeamAllocations(processedTeamAllocations);
          
          // Update node data in ReactFlow
          updateNodeData(id, {
            ...parsedData,
            title: serverData.data.title || parsedData.title,
            description: serverData.data.description || parsedData.description,
            buildType,
            teamAllocations: processedTeamAllocations,
            startDate: serverData.data.startDate,
            endDate: serverData.data.endDate,
            duration: serverData.data.duration
          });
          
          console.log('✅ Successfully initialized feature data with teamAllocations:', processedTeamAllocations);
          
        } catch (error) {
          console.error(`❌ Error fetching node data for ${id}:`, error);
          
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
  }, [id, parsedData, updateNodeData]);
  
  // Update local state when data changes from the props
  useEffect(() => {
    // Only update if we're not loading and the initial fetch is complete
    if (!isLoading && initialFetchCompletedRef.current) {
      console.log(`🔄 Updating local state from data props for ${id}`);
      
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
      
      // Process teamAllocations if it's available
      if (parsedData.teamAllocations) {
        let processedAllocations: TeamAllocation[] = [];
        
        if (Array.isArray(parsedData.teamAllocations)) {
          processedAllocations = parsedData.teamAllocations;
        } else if (typeof parsedData.teamAllocations === 'string') {
          try {
            processedAllocations = JSON.parse(parsedData.teamAllocations);
          } catch (e) {
            console.error('❌ Failed to parse teamAllocations from props:', e);
          }
        } else {
          console.warn('Unexpected teamAllocations format:', typeof parsedData.teamAllocations, parsedData.teamAllocations);
          // Keep existing allocations
          processedAllocations = teamAllocations;
        }
        
        // Only update if there's a difference
        const currentString = JSON.stringify(teamAllocations);
        const newString = JSON.stringify(processedAllocations);
        
        if (currentString !== newString) {
          console.log('🔄 Updating teamAllocations from data props:', processedAllocations);
          setTeamAllocations(processedAllocations);
        }
      } else {
        console.warn('Unexpected teamAllocations format:', typeof parsedData.teamAllocations, parsedData.teamAllocations);
        setTeamAllocations([]);
      }
    }
  }, [parsedData.title, parsedData.description, parsedData.buildType, parsedData.teamAllocations, isLoading, initialFetchCompletedRef]);
  
  // Save team allocations to backend
  const saveTeamAllocationsToBackend = useCallback(async (allocations: TeamAllocation[]) => {
    try {
      // Log the team allocations before sending to backend
      console.log('Team allocations being sent to backend:', JSON.stringify(allocations, null, 2));
      
      await GraphApiClient.updateNode('feature' as NodeType, id, {
        teamAllocations: allocations
      });
      console.log('✅ Successfully saved team allocations to backend');
    } catch (error) {
      console.error('❌ Failed to save team allocations to backend:', error);
    }
  }, [id]);

  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, parsedData);
  
  // Add the saveTeamAllocationsToBackend function to the teamAllocationHook
  (teamAllocationHook as any).saveTeamAllocationsToBackend = saveTeamAllocationsToBackend;
  
  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.teamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costs = teamAllocationHook.costs;
  
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

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state first
    setTitle(newTitle);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, title: newTitle });
    
    // Save to backend
    saveToBackend({ title: newTitle });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Update local state first
    setDescription(newDescription);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, description: newDescription });
    
    // Save to backend
    saveToBackend({ description: newDescription });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle build type change
  const handleBuildTypeChange = useCallback((newBuildType: BuildType) => {
    console.log(`Changing build type to: ${newBuildType}`);
    
    // Ensure the new build type is valid
    const validBuildType = ensureValidBuildType(newBuildType);
    
    // Check if value actually changed to prevent unnecessary updates
    if (buildType === validBuildType) {
      console.log('Build type unchanged, skipping update');
      return;
    }
    
    // Set initialized flag to prevent redundant default setting
    isInitializedRef.current = true;
    
    // Update local state first
    setBuildType(validBuildType);
    
    // Create a new object for the update to avoid reference issues
    const updatedData = { ...parsedData, buildType: validBuildType };
    
    // Then update ReactFlow state
    updateNodeData(id, updatedData);
    
    // Save to backend
    saveToBackend({ buildType: validBuildType });
  }, [id, parsedData, updateNodeData, saveToBackend, buildType, ensureValidBuildType]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    GraphApiClient.deleteNode('feature' as NodeType, id)
      .then(() => {
        console.log(`Successfully deleted feature node ${id}`);
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
      saveToBackend({ duration: parsedData.duration });
    }
  }, [parsedData.duration, saveToBackend]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (teamAllocationsDebounceRef.current?.timeout) clearTimeout(teamAllocationsDebounceRef.current.timeout);
    };
  }, []);

  // Return the hook API
  return useMemo(() => ({
    // State
    title,
    description,
    buildType,
    status,
    isLoading,
    processedGoals: [],
    processedRisks: [],
    processedTeamAllocations: teamAllocationsFromHook,
    connectedTeams,
    costs,
    
    // Handlers
    handleTitleChange,
    handleDescriptionChange,
    handleBuildTypeChange,
    handleDelete,
    refreshData,
    
    // Resource allocation handlers
    handleAllocationChangeLocal: resourceAllocation.handleAllocationChangeLocal,
    handleAllocationCommit: resourceAllocation.handleAllocationCommit,
    calculateMemberAllocations: resourceAllocation.calculateMemberAllocations,
    calculateCostSummary: resourceAllocation.calculateCostSummary,
    requestTeamAllocation: teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    
    // Goal handlers
    addGoal: () => {},
    updateGoal: () => {},
    removeGoal: () => {},
    
    // Risk handlers
    addRisk: () => {},
    updateRisk: () => {},
    removeRisk: () => {},
    
    // Status
    getStatusColor,
    cycleStatus,
    
    // Duration
    duration,
  }), [
    title,
    description,
    buildType,
    status,
    isLoading,
    teamAllocationsFromHook,
    connectedTeams,
    costs,
    handleTitleChange,
    handleDescriptionChange,
    handleBuildTypeChange,
    handleDelete,
    refreshData,
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