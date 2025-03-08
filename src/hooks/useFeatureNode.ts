import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { NodeStatus } from "@/services/graph/shared/shared.types";

// Utility function to round numbers to 1 decimal place for better display
const roundToOneDecimal = (num: number): number => {
  return Math.round(num * 10) / 10;
};

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
  
  // State for the feature node
  const [title, setTitle] = useState(data.title || '');
  const [description, setDescription] = useState(data.description || '');
  const [buildType, setBuildType] = useState<BuildType>(data.buildType || 'internal');
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
        ...data,
        title: serverData.data.title || data.title,
        description: serverData.data.description || data.description,
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
  }, [id, data, updateNodeData]);
  
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
            ...data,
            title: serverData.data.title || data.title,
            description: serverData.data.description || data.description,
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
  }, [id, data, updateNodeData]);
  
  // Update local state when data changes from the props
  useEffect(() => {
    // Only update if we're not loading and the initial fetch is complete
    if (!isLoading && initialFetchCompletedRef.current) {
      console.log(`🔄 Updating local state from data props for ${id}`);
      
      // Check if the data has changed to avoid unnecessary updates
      if (title !== data.title) {
        setTitle(data.title || '');
      }
      
      if (description !== data.description) {
        setDescription(data.description || '');
      }
      
      const validBuildType = ensureValidBuildType(data.buildType);
      if (buildType !== validBuildType) {
        setBuildType(validBuildType);
      }
      
      // Process teamAllocations if it's available
      if (data.teamAllocations) {
        let processedAllocations: TeamAllocation[] = [];
        
        if (Array.isArray(data.teamAllocations)) {
          processedAllocations = data.teamAllocations;
        } else if (typeof data.teamAllocations === 'string') {
          try {
            processedAllocations = JSON.parse(data.teamAllocations);
          } catch (e) {
            console.error('❌ Failed to parse teamAllocations from props:', e);
          }
        } else {
          console.warn('Unexpected teamAllocations format:', typeof data.teamAllocations, data.teamAllocations);
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
        console.warn('Unexpected teamAllocations format:', typeof data.teamAllocations, data.teamAllocations);
        setTeamAllocations([]);
      }
    }
  }, [data.title, data.description, data.buildType, data.teamAllocations, isLoading, initialFetchCompletedRef]);
  
  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, data);
  
  // Extract the processed team allocations from the hook
  const processedTeamAllocations = teamAllocationHook.teamAllocations;
  
  // Log the processed team allocations
  console.log('🔍 Processed team allocations in useFeatureNode:', processedTeamAllocations);
  
  // Listen for edge changes and refresh data when a new edge is created
  const edgeConnectionsRef = useRef<string[]>([]);
  
  useEffect(() => {
    const edges = getEdges();
    
    // Find edges connected to this feature node
    const connectedEdges = edges.filter(edge => 
      edge.source === id || edge.target === id
    );
    
    // Create a string representation of the connected edges for comparison
    const edgeConnectionsString = connectedEdges
      .map(edge => `${edge.source}-${edge.target}`)
      .sort()
      .join(',');
    
    // Only refresh if the connections have changed
    if (edgeConnectionsString !== edgeConnectionsRef.current.join(',') && initialFetchCompletedRef.current) {
      console.log(`🔄 Detected edge changes for feature ${id}, refreshing data`);
      
      // Update the ref with the new connections
      edgeConnectionsRef.current = edgeConnectionsString.split(',').filter(Boolean);
      
      // Use a short delay to ensure the server has processed the edge creation
      const timer = setTimeout(() => {
        refreshData();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [id, getEdges, refreshData, initialFetchCompletedRef]);
  
  // Use the node status hook for status-related operations
  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, data, updateNodeData, {
    canBeActive: true, // Features can be "active" after completion
    defaultStatus: 'planning'
  });
  
  // Use the duration input hook for duration-related operations
  const duration = useDurationInput(id, data, updateNodeData, {
    maxDays: 72,
    label: "Time to Build",
    fieldName: "duration",
    tip: 'Use "w" for weeks (e.g. "2w" = 2 weeks) or ↑↓ keys. Hold Shift for week increments.'
  });
  
  // Function to save data to backend with debouncing
  const saveToBackend = useCallback(async (updatedData: Partial<RFFeatureNodeData>) => {
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    titleDebounceRef.current = setTimeout(async () => {
      try {
        await GraphApiClient.updateNode('feature' as NodeType, id, updatedData);
        console.log(`Updated feature ${id}`);
      } catch (error) {
        console.error(`Failed to update feature ${id}:`, error);
        toast.error("Your changes couldn't be saved to the database.");
      }
      titleDebounceRef.current = null;
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
      console.log('💾 Saving teamAllocations to backend:', JSON.stringify(teamAllocations));
      
      // Save to backend using fetch directly to ensure proper JSON handling
      try {
        const response = await fetch(`/api/graph/feature/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamAllocations })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save team allocations: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Team allocations saved successfully:', result);
        
        // Parse the response to check what was actually saved
        if (result.data && result.data.teamAllocations) {
          console.log('📊 Server returned teamAllocations:', 
            Array.isArray(result.data.teamAllocations) 
              ? result.data.teamAllocations 
              : typeof result.data.teamAllocations === 'string'
                ? 'String: ' + result.data.teamAllocations.substring(0, 50) + '...'
                : result.data.teamAllocations
          );
        }
      } catch (error) {
        console.error('❌ Failed to save team allocations:', error);
        toast.error("Team allocations couldn't be saved to the database.");
      }
      
      teamAllocationsDebounceRef.current.timeout = null;
    }, 1000);
  }, [id]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state first
    setTitle(newTitle);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...data, title: newTitle });
    
    // Save to backend
    saveToBackend({ title: newTitle });
  }, [id, data, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Update local state first
    setDescription(newDescription);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...data, description: newDescription });
    
    // Save to backend
    saveToBackend({ description: newDescription });
  }, [id, data, updateNodeData, saveToBackend]);

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
    const updatedData = { ...data, buildType: validBuildType };
    
    // Then update ReactFlow state
    updateNodeData(id, updatedData);
    
    // Save to backend
    saveToBackend({ buildType: validBuildType });
  }, [id, data, updateNodeData, saveToBackend, buildType, ensureValidBuildType]);

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

  // Handle team allocation
  const handleTeamAllocation = useCallback((teamId: string, hoursRequested: number) => {
    if (!teamId) return;
    
    // Create a function to compute the next state without calling setState inside setState
    const getUpdatedAllocations = (currentAllocations: TeamAllocation[]): TeamAllocation[] => {
      const updatedTeamAllocations = [...currentAllocations];
      const existingAllocationIndex = updatedTeamAllocations.findIndex(a => a.teamId === teamId);
      
      if (existingAllocationIndex >= 0) {
        updatedTeamAllocations[existingAllocationIndex] = {
          ...updatedTeamAllocations[existingAllocationIndex],
          requestedHours: roundToOneDecimal(hoursRequested),
        };
      } else {
        updatedTeamAllocations.push({
          teamId,
          requestedHours: roundToOneDecimal(hoursRequested),
          allocatedMembers: [],
        });
      }
      
      return updatedTeamAllocations;
    };
    
    // First compute the new state
    const nextAllocations = getUpdatedAllocations(teamAllocations);
    
    // Update local state first for immediate UI response
    setTeamAllocations(nextAllocations);
    
    // Then update ReactFlow state separate from the setState callback
    updateNodeData(id, { ...data, teamAllocations: nextAllocations });
    
    // Save to backend
    saveTeamAllocationsToBackend(nextAllocations);
  }, [id, data, teamAllocations, updateNodeData, saveTeamAllocationsToBackend]);

  // Handle team member allocation
  const handleTeamMemberAllocation = useCallback((teamId: string, memberId: string, hoursRequested: number) => {
    if (!teamId || !memberId) return;
    
    console.log(`🔄 Updating team member allocation: teamId=${teamId}, memberId=${memberId}, hours=${hoursRequested}`);
    
    // Find the team and member to get the name
    const team = teamAllocationHook.connectedTeams.find(t => t.teamId === teamId);
    const member = team?.availableBandwidth.find(m => m.memberId === memberId);
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (member?.name || memberId.split('-')[0]);
    
    // Create a function to compute the next state without calling setState inside setState
    const getUpdatedAllocations = (currentAllocations: TeamAllocation[]): TeamAllocation[] => {
      const updatedTeamAllocations: TeamAllocation[] = [...currentAllocations];
      const existingAllocationIndex = updatedTeamAllocations.findIndex(a => a.teamId === teamId);
      
      if (existingAllocationIndex >= 0) {
        const existingAllocation = updatedTeamAllocations[existingAllocationIndex];
        const existingMemberIndex = existingAllocation.allocatedMembers.findIndex(m => m.memberId === memberId);
        
        if (existingMemberIndex >= 0) {
          existingAllocation.allocatedMembers[existingMemberIndex].hours = roundToOneDecimal(hoursRequested);
          // Update name if it wasn't set before or if we have a better name now
          existingAllocation.allocatedMembers[existingMemberIndex].name = memberName;
        } else {
          existingAllocation.allocatedMembers.push({
            memberId,
            name: memberName,
            hours: roundToOneDecimal(hoursRequested),
          });
        }
        
        existingAllocation.requestedHours = roundToOneDecimal(
          existingAllocation.allocatedMembers.reduce(
            (sum, member) => sum + member.hours, 0
          )
        );
      } else {
        updatedTeamAllocations.push({
          teamId,
          requestedHours: roundToOneDecimal(hoursRequested),
          allocatedMembers: [{
            memberId,
            name: memberName,
            hours: roundToOneDecimal(hoursRequested),
          }],
        });
      }
      
      return updatedTeamAllocations;
    };
    
    // First compute the new state
    const nextAllocations = getUpdatedAllocations(teamAllocations);
    
    // Update local state first for immediate UI response
    setTeamAllocations(nextAllocations);
    
    console.log('📊 Updated team allocations:', JSON.stringify(nextAllocations));
    
    // Then update ReactFlow state separate from the setState callback
    updateNodeData(id, { ...data, teamAllocations: nextAllocations });
    
    // Save to backend
    saveTeamAllocationsToBackend(nextAllocations);
    
    // Request team allocation separately
    teamAllocationHook.requestTeamAllocation(teamId, hoursRequested, [memberId]);
  }, [id, data, teamAllocations, updateNodeData, saveTeamAllocationsToBackend, teamAllocationHook, teamAllocationHook.connectedTeams]);

  // Handle allocation percentage change - local state only (no backend save)
  const handleAllocationChangeLocal = useCallback((memberId: string, percentage: number) => {
    // Find the team for this member
    const team = teamAllocationHook.connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    );
    
    if (!team) {
      console.warn(`⚠️ Could not find team for member ${memberId}`);
      return;
    }
    
    const teamId = team.teamId;
    
    // Calculate hours based on percentage
    const duration = Number(data.duration) || 1;
    const hoursPerDay = 8; // Default working hours per day
    
    // Ensure percentage is a valid number
    const validPercentage = isNaN(percentage) ? 0 : percentage;
    
    // Calculate hours: (percentage / 100) * duration * hours per day
    const hoursRequested = roundToOneDecimal((validPercentage / 100) * duration * hoursPerDay);
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const member = team.availableBandwidth.find(m => m.memberId === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (member?.name || memberId.split('-')[0]);
    
    // Create a function to compute the next state without calling setState inside setState
    const getUpdatedAllocations = (currentAllocations: TeamAllocation[]): TeamAllocation[] => {
      const updatedTeamAllocations: TeamAllocation[] = [...currentAllocations];
      const existingAllocationIndex = updatedTeamAllocations.findIndex(a => a.teamId === teamId);
      
      if (existingAllocationIndex >= 0) {
        const existingAllocation = updatedTeamAllocations[existingAllocationIndex];
        const existingMemberIndex = existingAllocation.allocatedMembers.findIndex(m => m.memberId === memberId);
        
        if (existingMemberIndex >= 0) {
          existingAllocation.allocatedMembers[existingMemberIndex].hours = roundToOneDecimal(hoursRequested);
          // Update name if we have a better name now
          existingAllocation.allocatedMembers[existingMemberIndex].name = memberName;
        } else {
          existingAllocation.allocatedMembers.push({
            memberId,
            name: memberName,
            hours: roundToOneDecimal(hoursRequested),
          });
        }
        
        existingAllocation.requestedHours = roundToOneDecimal(
          existingAllocation.allocatedMembers.reduce(
            (sum, member) => sum + member.hours, 0
          )
        );
      } else {
        // Find the team and member to get the name
        const member = team?.availableBandwidth.find(m => m.memberId === memberId);
        const memberName = member?.name || memberId.split('-')[0];
        
        updatedTeamAllocations.push({
          teamId,
          requestedHours: roundToOneDecimal(hoursRequested),
          allocatedMembers: [{
            memberId,
            name: memberName,
            hours: roundToOneDecimal(hoursRequested),
          }],
        });
      }
      
      return updatedTeamAllocations;
    };
    
    // Compute the new state
    const nextAllocations = getUpdatedAllocations(teamAllocations);
    
    // Update local state only for immediate UI feedback
    setTeamAllocations(nextAllocations);
    
    // Update ReactFlow state for immediate UI feedback
    updateNodeData(id, { ...data, teamAllocations: nextAllocations });
    
  }, [id, data, teamAllocations, updateNodeData, teamAllocationHook.connectedTeams, getNodes]);

  // Handle allocation commit - save to backend when the user finishes dragging
  const handleAllocationCommit = useCallback((memberId: string, percentage: number) => {
    // Find the team for this member
    const team = teamAllocationHook.connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    );
    
    if (!team) {
      console.warn(`⚠️ Could not find team for member ${memberId}`);
      return;
    }
    
    const teamId = team.teamId;
    
    // Calculate hours based on percentage
    const duration = Number(data.duration) || 1;
    const hoursPerDay = 8; // Default working hours per day
    
    // Ensure percentage is a valid number
    const validPercentage = isNaN(percentage) ? 0 : percentage;
    
    // Calculate hours: (percentage / 100) * duration * hours per day
    const hoursRequested = roundToOneDecimal((validPercentage / 100) * duration * hoursPerDay);
    
    console.log(`🔄 Committing allocation for member ${memberId} in team ${teamId}:`, {
      percentage: validPercentage,
      duration,
      hoursPerDay,
      hoursRequested
    });
    
    // Save to backend
    saveTeamAllocationsToBackend(teamAllocations);
    
    // Request team allocation separately with the correct member name
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const member = team.availableBandwidth.find(m => m.memberId === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (member?.name || memberId.split('-')[0]);
    
    teamAllocationHook.requestTeamAllocation(teamId, hoursRequested, [{
      memberId,
      name: memberName,
      hours: hoursRequested
    }]);
  }, [teamAllocationHook.connectedTeams, data.duration, teamAllocations, saveTeamAllocationsToBackend, teamAllocationHook, getNodes]);

  // Original handleAllocationChange function - kept for backward compatibility
  const handleAllocationChange = useCallback((memberId: string, percentage: number) => {
    // Find the team for this member
    const team = teamAllocationHook.connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    );
    
    if (!team) {
      console.warn(`⚠️ Could not find team for member ${memberId}`);
      return;
    }
    
    const teamId = team.teamId;
    
    // Calculate hours based on percentage
    const duration = Number(data.duration) || 1;
    const hoursPerDay = 8; // Default working hours per day
    
    // Ensure percentage is a valid number
    const validPercentage = isNaN(percentage) ? 0 : percentage;
    
    // Calculate hours: (percentage / 100) * duration * hours per day
    const hoursRequested = roundToOneDecimal((validPercentage / 100) * duration * hoursPerDay);
    
    console.log(`🔄 Updating allocation for member ${memberId} in team ${teamId}:`, {
      percentage: validPercentage,
      duration,
      hoursPerDay,
      hoursRequested
    });
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const member = team.availableBandwidth.find(m => m.memberId === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (member?.name || memberId.split('-')[0]);
    
    // Use existing function to update allocation with the correct name
    handleTeamMemberAllocation(teamId, memberId, hoursRequested);
  }, [teamAllocationHook.connectedTeams, data.duration, handleTeamMemberAllocation, getNodes]);

  // Ensure teamAllocations is always an array
  useEffect(() => {
    if (data.teamAllocations === undefined || data.teamAllocations === null) {
      updateNodeData(id, { ...data, teamAllocations: [] });
      return;
    }
    
    if (!Array.isArray(data.teamAllocations)) {
      if (typeof data.teamAllocations === 'string') {
        try {
          const parsed = JSON.parse(data.teamAllocations);
          if (Array.isArray(parsed)) {
            updateNodeData(id, { ...data, teamAllocations: parsed });
          } else {
            updateNodeData(id, { ...data, teamAllocations: [] });
          }
        } catch (e) {
          updateNodeData(id, { ...data, teamAllocations: [] });
        }
      } else {
        updateNodeData(id, { ...data, teamAllocations: [] });
      }
    }
  }, [id, data, updateNodeData]);

  // Save duration to backend when it changes
  useEffect(() => {
    if (data.duration !== undefined) {
      saveToBackend({ duration: data.duration });
    }
  }, [data.duration, saveToBackend]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (teamAllocationsDebounceRef.current?.timeout) clearTimeout(teamAllocationsDebounceRef.current.timeout);
    };
  }, []);

  // Return all the values and functions needed by the feature node component
  return {
    title,
    setTitle,
    description,
    setDescription,
    buildType,
    setBuildType,
    teamAllocations,
    processedTeamAllocations, // Use the processed team allocations from useTeamAllocation
    setTeamAllocations,
    isLoading,
    refreshData,
    handleTitleChange,
    handleDescriptionChange,
    handleBuildTypeChange,
    handleTeamAllocation,
    handleTeamMemberAllocation,
    handleAllocationChange,
    handleAllocationChangeLocal,
    handleAllocationCommit,
    requestTeamAllocation: teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    connectedTeams: teamAllocationHook.connectedTeams, // Use the connected teams from useTeamAllocation
    status,
    getStatusColor,
    cycleStatus,
    duration
  };
} 