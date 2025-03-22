import { useCallback, useEffect, useMemo, useRef } from "react";
import { useReactFlow, useNodeConnections, Node } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFTeamMemberNodeData, 
  TeamMemberSummary, 
  TIMEZONES,
  DEFAULT_START_DATE,
  EARLIEST_START_DATE,
} from '@/services/graph/team-member/team-member.types';
import { RFTeamNodeData } from '@/services/graph/team/team.types';
import { ValidationError } from '@/types/validation';
import { prepareDataForBackend, parseDataFromBackend } from "@/utils/utils";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useNodeObserver } from '@/hooks/useNodeObserver';

/**
 * Type guard for team nodes
 */
function isTeamNode(node: Node | null | undefined): node is Node<RFTeamNodeData> {
  return Boolean(
    node?.type === 'team' && 
    node?.data
  );
}

/**
 * Hook for managing team member node state and operations
 * Separates domain logic from React Flow component state
 */
export function useTeamMemberNode(
  id: string, 
  data: RFTeamMemberNodeData,
  addError?: (nodeId: string, error: ValidationError) => void,
  clearErrors?: (nodeId: string) => void
) {
  const { updateNodeData, setNodes, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id });
  
  // Add the node observer hook
  const { publishManifestUpdate, subscribeBasedOnManifest } = useNodeObserver<RFTeamMemberNodeData>(id, 'teamMember');
  
  // Define JSON fields that need special handling with useMemo to prevent recreation
  const jsonFields = useMemo(() => ['skills', 'roles'], []);
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFTeamMemberNodeData;
  }, [data, jsonFields]);
  
  // Use the node status hook to manage status
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    parsedData, 
    updateNodeData, 
    {
      defaultStatus: 'planning'
    }
  );
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const bioDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const hoursDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const daysDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const startDateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rolesDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const timezoneDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const allocationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to refresh data from the backend
  const refreshData = useCallback(async () => {
    try {
      // No need to track loading state since we're not using it in the UI
      
      if (GraphApiClient.isNodeBlacklisted(id)) {
        toast.error("This node is blacklisted and cannot be refreshed");
        return;
      }
      
      const serverData = await GraphApiClient.getNode('teamMember' as NodeType, id);
      
      if (serverData && serverData.data) {
        // Process data from the server
        const processedData = parseDataFromBackend(serverData.data, jsonFields) as RFTeamMemberNodeData;
        
        // Update node data in ReactFlow
        updateNodeData(id, {
          ...processedData
        });
        
        toast.success("Team member data refreshed");
      }
    } catch (error) {
      console.error(`Error refreshing team member data for ${id}:`, error);
      toast.error(`Failed to refresh team member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, updateNodeData, jsonFields]);
  
  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFTeamMemberNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('teamMember' as NodeType, id, apiData);
      
      // Update React Flow state with the original object data (not stringified)
      updateNodeData(id, updates);
    } catch (error) {
      console.error(`Failed to update team member node:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, updateNodeData, jsonFields]);

  // Initialize with defaults if values are undefined
  useEffect(() => {
    if (data.hoursPerDay === undefined || 
        data.daysPerWeek === undefined || 
        !data.startDate) {
      updateNodeData(id, {
        ...data,
        hoursPerDay: data.hoursPerDay ?? 8,
        daysPerWeek: data.daysPerWeek ?? 5,
        weeklyCapacity: (data.hoursPerDay ?? 8) * (data.daysPerWeek ?? 5),
        startDate: data.startDate ?? DEFAULT_START_DATE,
        // Ensure name is set if it's not already
        name: data.name ?? data.title ?? 'Untitled Team Member',
        // Ensure description is set if it's not already
        description: data.description ?? data.bio ?? '',
      });
    }
  }, [id, data, updateNodeData]);

  // Function to update the connected team's roster with new capacity or allocation
  const updateConnectedTeam = useCallback((newWeeklyCapacity?: number, newAllocation?: number) => {
    // Find the connected team
    const teamConnection = connections.find(conn => {
      const node = getNodes().find(n => n.id === (conn.source === id ? conn.target : conn.source));
      return node?.type === 'team';
    });
    
    if (teamConnection) {
      const teamId = teamConnection.source === id ? teamConnection.target : teamConnection.source;
      const teamNode = getNodes().find(n => n.id === teamId);
      
      if (isTeamNode(teamNode)) {
        // Parse the roster
        let roster: { memberId: string; weeklyCapacity?: number; allocation?: number }[] = [];
        try {
          roster = typeof teamNode.data.roster === 'string' 
            ? JSON.parse(teamNode.data.roster) 
            : (teamNode.data.roster || []);
        } catch (e) {
          console.warn('Failed to parse team roster:', e);
          roster = [];
        }
        
        // Find and update this member in the roster
        const updatedRoster = roster.map((member) => {
          if (member.memberId === id) {
            // Create updated member object
            const updatedMember = { ...member };
            
            // Update weeklyCapacity if provided
            if (newWeeklyCapacity !== undefined) {
              updatedMember.weeklyCapacity = newWeeklyCapacity;
            }
            
            // Update allocation if provided
            if (newAllocation !== undefined) {
              updatedMember.allocation = newAllocation;
            }
            
            return updatedMember;
          }
          return member;
        });
        
        // Update the team node
        updateNodeData(teamId, {
          ...teamNode.data,
          roster: updatedRoster
        });
        
        // Save to backend
        GraphApiClient.updateNode('team', teamId, { 
          roster: JSON.stringify(updatedRoster) 
        })
        .then(() => {
          if (newWeeklyCapacity !== undefined) {
            console.log(`[TeamMemberNode] Updated team ${teamId} with new capacity: ${newWeeklyCapacity}h`);
          }
          if (newAllocation !== undefined) {
            console.log(`[TeamMemberNode] Updated team ${teamId} with new allocation: ${newAllocation}%`);
          }
        })
        .catch(error => {
          console.error('Failed to update team roster:', error);
        });
      }
    }
  }, [id, connections, getNodes, updateNodeData]);

  // Calculate weekly capacity
  const updateWeeklyCapacity = useCallback((hoursPerDay: number, daysPerWeek: number) => {
    const newWeeklyCapacity = hoursPerDay * daysPerWeek;
    const updatedData: Partial<RFTeamMemberNodeData> = {
      hoursPerDay,
      daysPerWeek,
      weeklyCapacity: newWeeklyCapacity
    };
    
    // Update the node data
    updateNodeData(id, { ...data, ...updatedData });
    
    // Save to backend
    saveToBackend(updatedData);
    
    // Update connected team's roster with new capacity
    updateConnectedTeam(newWeeklyCapacity);
    
  }, [id, data, updateNodeData, saveToBackend, updateConnectedTeam]);

  // Calculate effective capacity (weekly capacity adjusted for team allocation)
  const calculateEffectiveCapacity = useCallback((weeklyCapacity: number, allocation: number) => {
    return (weeklyCapacity * allocation) / 100;
  }, []);

  // Validation handlers
  const validateHoursPerDay = useCallback((hours: number) => {
    if (!clearErrors || !addError) return;
    
    clearErrors(id);
    if (hours < 0 || hours > 24) {
      addError(id, {
        nodeId: id,
        field: 'hoursPerDay',
        message: 'Hours must be between 0 and 24'
      });
    }
  }, [id, addError, clearErrors]);

  const validateDaysPerWeek = useCallback((days: number) => {
    if (!clearErrors || !addError) return;
    
    clearErrors(id);
    if (days < 0 || days > 7) {
      addError(id, {
        nodeId: id,
        field: 'daysPerWeek',
        message: 'Days must be between 0 and 7'
      });
    }
  }, [id, addError, clearErrors]);

  const validateDailyRate = useCallback((rate: number) => {
    if (!clearErrors || !addError) return;
    
    clearErrors(id);
    if (rate < 0) {
      addError(id, {
        nodeId: id,
        field: 'dailyRate',
        message: 'Daily rate cannot be negative'
      });
    }
  }, [id, addError, clearErrors]);

  // Add validation handler for start date
  const validateStartDate = useCallback((dateStr: string) => {
    if (!clearErrors || !addError) return;
    
    clearErrors(id);
    const date = new Date(dateStr);
    const earliest = new Date(EARLIEST_START_DATE);
    
    if (date < earliest) {
      addError(id, {
        nodeId: id,
        field: 'startDate',
        message: 'Start date cannot be earlier than January 1, 2020'
      });
    }
  }, [id, addError, clearErrors]);

  // Update the input handlers to include validation and backend saving
  const handleHoursPerDayChange = useCallback((hours: number) => {
    const validHours = Math.min(Math.max(0, hours), 24);
    updateWeeklyCapacity(validHours, data.daysPerWeek ?? 5);
  }, [data.daysPerWeek, updateWeeklyCapacity]);

  const handleDaysPerWeekChange = useCallback((days: number) => {
    const validDays = Math.min(Math.max(0, days), 7);
    updateWeeklyCapacity(data.hoursPerDay ?? 8, validDays);
  }, [data.hoursPerDay, updateWeeklyCapacity]);

  const handleHourlyRateChange = useCallback((rate: number) => {
    if (!isNaN(rate)) {
      const updatedData: Partial<RFTeamMemberNodeData> = { hourlyRate: rate };
      updateNodeData(id, { ...data, ...updatedData });
      
      // Clear any existing debounce timer
      if (rateDebounceRef.current) {
        clearTimeout(rateDebounceRef.current);
      }
      
      // Set a new debounce timer
      rateDebounceRef.current = setTimeout(async () => {
        await saveToBackend(updatedData);
        rateDebounceRef.current = null;
      }, 1000); // 1 second debounce
    }
  }, [id, data, updateNodeData, saveToBackend]);

  // Update the start date handler
  const handleStartDateChange = useCallback((startDate: string) => {
    const validStartDate = startDate || DEFAULT_START_DATE;
    const updatedData: Partial<RFTeamMemberNodeData> = { startDate: validStartDate };
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (startDateDebounceRef.current) {
      clearTimeout(startDateDebounceRef.current);
    }
    
    // Set a new debounce timer
    startDateDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      startDateDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

  const handleDelete = useCallback(() => {
    // Delete the node from the backend
    GraphApiClient.deleteNode('teamMember' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also remove any connected edges by showing the change in the UI
        // No need to store the connected edges in a variable since we're doing this in-place
        connections.forEach(conn => {
          console.log(`Removing connection: ${conn.source} -> ${conn.target}`);
        });
      })
      .catch((error) => {
        console.error('Failed to delete team member node:', error);
        toast.error("Delete Failed: Failed to delete the team member node from the server.");
      });
  }, [id, setNodes, connections]);

  // Calculate member summary data
  const memberSummary = useMemo<TeamMemberSummary>(() => ({
    id,
    weeklyCapacity: data.weeklyCapacity || 0,
    dailyRate: data.hourlyRate || 0,
    roles: data.roles || [],
    allocation: data.allocation || 0,
    startDate: data.startDate
  }), [
    id,
    data.weeklyCapacity,
    data.hourlyRate,
    data.roles,
    data.allocation,
    data.startDate
  ]);

  // Add handler for roles with backend saving
  const handleRolesChange = useCallback((role: string, checked: boolean) => {
    const updatedRoles = checked 
      ? [...(data.roles || []), role]
      : (data.roles || []).filter(r => r !== role);
    
    const updatedData: Partial<RFTeamMemberNodeData> = { roles: updatedRoles };
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (rolesDebounceRef.current) {
      clearTimeout(rolesDebounceRef.current);
    }
    
    // Set a new debounce timer
    rolesDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      rolesDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

  // Update title handler to also update name for consistency and save to backend
  const handleTitleChange = useCallback((title: string) => {
    const updatedData: Partial<RFTeamMemberNodeData> = { 
      title,
      name: title // Keep name in sync with title
    };
    
    // Update ReactFlow state first
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      
      // Publish update to the observer system using the manifest AFTER saving
      publishManifestUpdate({
        ...data,
        ...updatedData
      }, 
      ['title'], // Specify which fields from the manifest are being updated
      {
        source: 'ui'
      });
      
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);

  // Update bio handler to also update description for consistency and save to backend
  const handleBioChange = useCallback((bio: string) => {
    const updatedData: Partial<RFTeamMemberNodeData> = { 
      bio,
      description: bio // Keep description in sync with bio
    };
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (bioDebounceRef.current) {
      clearTimeout(bioDebounceRef.current);
    }
    
    // Set a new debounce timer
    bioDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      
      // Publish update to the observer system using the manifest AFTER saving
      publishManifestUpdate({
        ...data,
        ...updatedData
      }, 
      ['description'], // Specify which fields from the manifest are being updated
      {
        source: 'ui'
      });
      
      bioDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);

  // Add handler for timezone with backend saving
  const handleTimezoneChange = useCallback((timezone: string) => {
    const updatedData: Partial<RFTeamMemberNodeData> = { timezone };
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (timezoneDebounceRef.current) {
      clearTimeout(timezoneDebounceRef.current);
    }
    
    // Set a new debounce timer
    timezoneDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      timezoneDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

  // Handle allocation change
  const handleAllocationChange = useCallback((allocationValue: number) => {
    // Validate allocation within range
    const boundedAllocation = Math.max(0, Math.min(100, allocationValue));
    
    // Update node data
    updateNodeData(id, { ...data, allocation: boundedAllocation });
    
    // Calculate effective capacity based on new allocation
    const weeklyCapacity = data.weeklyCapacity || (data.hoursPerDay || 8) * (data.daysPerWeek || 5);
    const effectiveCapacity = calculateEffectiveCapacity(weeklyCapacity, boundedAllocation);
    console.log(`[TeamMemberNode] Effective capacity updated: ${effectiveCapacity}h (${boundedAllocation}% of ${weeklyCapacity}h)`);
    
    // Save to backend
    saveToBackend({ allocation: boundedAllocation });
    
    // Update connected team with new allocation
    updateConnectedTeam(undefined, boundedAllocation);
  }, [id, data, updateNodeData, saveToBackend, calculateEffectiveCapacity, updateConnectedTeam]);

  // Subscribe to updates from other nodes based on manifest
  useEffect(() => {
    if (!id) return;
    
    // Set up subscription based on manifest
    const { unsubscribe } = subscribeBasedOnManifest();
    
    // Listen for node data updates
    const handleNodeDataUpdated = (event: CustomEvent) => {
      interface NodeUpdateEventData {
        subscriberId: string;
        publisherType: string;
        publisherId: string;
        relevantFields: string[];
        data: Record<string, unknown>;
      }
      
      const { subscriberId, publisherType, publisherId, relevantFields, data: publisherData } = 
        event.detail as NodeUpdateEventData;
      
      // Only process events meant for this node
      if (subscriberId !== id) return;
      
      console.log(`TeamMember node ${id} received update from ${publisherType} ${publisherId}:`, {
        relevantFields,
        publisherData
      });
      
      // Handle updates from team nodes
      if (publisherType === 'team' && relevantFields.includes('roster')) {
        // Check if this team member is in the roster
        const roster = Array.isArray(publisherData.roster) ? publisherData.roster : [];
        const memberInRoster = roster.find((member: { memberId: string; allocation?: number }) => 
          member.memberId === id
        );
        
        if (memberInRoster) {
          // Update the team ID and allocation if needed
          const updatedData: Partial<RFTeamMemberNodeData> = {};
          let hasChanges = false;
          
          if (parsedData.teamId !== publisherId) {
            updatedData.teamId = publisherId;
            hasChanges = true;
          }
          
          if (parsedData.allocation !== memberInRoster.allocation) {
            updatedData.allocation = memberInRoster.allocation;
            hasChanges = true;
          }
          
          if (hasChanges) {
            // Update local state
            updateNodeData(id, { ...parsedData, ...updatedData });
            
            // Save to backend (debounced in saveToBackend function)
            saveToBackend(updatedData);
          }
        }
      }
      
      // Handle updates from feature nodes
      if (publisherType === 'feature' && relevantFields.includes('teamAllocations')) {
        // Feature allocation updates could be handled here if needed
        // For now, we're just logging the update
        console.log(`TeamMember ${id} received feature allocation update`);
      }
    };
    
    window.addEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    };
  }, [id, subscribeBasedOnManifest, parsedData, updateNodeData, saveToBackend]);

  // Update connection handling to pass summary data
  useEffect(() => {
    const teamConnection = connections.find(conn => {
      const node = getNodes().find(n => n.id === conn.target);
      return node?.type === 'team';
    });

    if (teamConnection) {
      const teamId = teamConnection.target;
      if (teamId !== data.teamId) {
        const updatedData: Partial<RFTeamMemberNodeData> = {
          teamId,
          allocation: 100,
        };
        updateNodeData(id, { ...data, ...updatedData });
        
        // Save team connection to backend
        saveToBackend({
          ...updatedData,
          memberSummary
        });
      }
    } else {
      if (data.teamId) {
        const updatedData: Partial<RFTeamMemberNodeData> = {
          teamId: undefined,
          allocation: undefined,
        };
        updateNodeData(id, { ...data, ...updatedData });
        
        // Save removal of team connection to backend
        saveToBackend({
          ...updatedData,
          memberSummary: undefined
        });
      }
    }
  }, [
    connections, 
    data, 
    id, 
    updateNodeData, 
    getNodes, 
    memberSummary,
    saveToBackend
  ]);

  // Clean up timers on unmount
  useEffect(() => {
    // Capture ref values when the effect runs
    const hoursTimer = hoursDebounceRef.current;
    const daysTimer = daysDebounceRef.current;
    const rateTimer = rateDebounceRef.current;
    const startDateTimer = startDateDebounceRef.current;
    const rolesTimer = rolesDebounceRef.current;
    const titleTimer = titleDebounceRef.current;
    const bioTimer = bioDebounceRef.current;
    const timezoneTimer = timezoneDebounceRef.current;
    const allocationTimer = allocationDebounceRef.current;
    
    return () => {
      // Use captured values in cleanup function
      if (titleTimer) clearTimeout(titleTimer);
      if (bioTimer) clearTimeout(bioTimer);
      if (hoursTimer) clearTimeout(hoursTimer);
      if (daysTimer) clearTimeout(daysTimer);
      if (rateTimer) clearTimeout(rateTimer);
      if (startDateTimer) clearTimeout(startDateTimer);
      if (rolesTimer) clearTimeout(rolesTimer);
      if (timezoneTimer) clearTimeout(timezoneTimer);
      if (allocationTimer) clearTimeout(allocationTimer);
    };
  }, []);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    title: data.title || '',
    bio: data.bio || '',
    roles: data.roles || [],
    timezone: data.timezone || '',
    hourlyRate: data.hourlyRate || 350,
    hoursPerDay: data.hoursPerDay || 8,
    daysPerWeek: data.daysPerWeek || 5,
    weeklyCapacity: data.weeklyCapacity || 0,
    startDate: data.startDate || DEFAULT_START_DATE,
    allocation: data.allocation || 0,
    memberSummary,
    status,
    
    // Validation
    validateHoursPerDay,
    validateDaysPerWeek,
    validateDailyRate,
    validateStartDate,
    
    // Actions
    handleTitleChange,
    handleBioChange,
    handleHoursPerDayChange,
    handleDaysPerWeekChange,
    handleDailyRateChange: handleHourlyRateChange,
    handleStartDateChange,
    handleRolesChange,
    handleTimezoneChange,
    handleAllocationChange,
    handleDelete,
    refreshData,
    getStatusColor,
    cycleStatus,
    
    // Constants
    TIMEZONES,
    DEFAULT_START_DATE,
    EARLIEST_START_DATE
  }), [
    data.title,
    data.bio,
    data.roles,
    data.timezone,
    data.hourlyRate,
    data.hoursPerDay,
    data.daysPerWeek,
    data.weeklyCapacity,
    data.startDate,
    data.allocation,
    memberSummary,
    status,
    validateHoursPerDay,
    validateDaysPerWeek,
    validateDailyRate,
    validateStartDate,
    handleTitleChange,
    handleBioChange,
    handleHoursPerDayChange,
    handleDaysPerWeekChange,
    handleHourlyRateChange,
    handleStartDateChange,
    handleRolesChange,
    handleTimezoneChange,
    handleAllocationChange,
    handleDelete,
    refreshData,
    getStatusColor,
    cycleStatus
  ]);
} 