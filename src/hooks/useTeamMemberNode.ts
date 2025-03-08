import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { RFTeamNodeData, RosterMember } from '@/services/graph/team/team.types';
import { ValidationError } from '@/types/validation';
import { prepareDataForBackend, parseDataFromBackend } from "@/lib/utils";

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
  clearErrors?: (nodeId: string) => void,
  getErrors?: (nodeId: string) => ValidationError[]
) {
  const { updateNodeData, setNodes, getNodes, getNode } = useReactFlow();
  const connections = useNodeConnections({ id });
  
  // Define JSON fields that need special handling
  const jsonFields = ['skills', 'roles'];
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFTeamMemberNodeData;
  }, [data, jsonFields]);
  
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

  // Calculate weekly capacity
  const updateWeeklyCapacity = useCallback((hoursPerDay: number, daysPerWeek: number) => {
    const updatedData: Partial<RFTeamMemberNodeData> = {
      hoursPerDay,
      daysPerWeek,
      weeklyCapacity: hoursPerDay * daysPerWeek
    };
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (hoursDebounceRef.current) {
      clearTimeout(hoursDebounceRef.current);
    }
    if (daysDebounceRef.current) {
      clearTimeout(daysDebounceRef.current);
    }
    
    // Set a new debounce timer
    const debounceTimer = setTimeout(async () => {
      await saveToBackend(updatedData);
    }, 1000); // 1 second debounce
    
    // Store the timer reference
    hoursDebounceRef.current = debounceTimer;
    daysDebounceRef.current = debounceTimer;
  }, [id, data, updateNodeData, saveToBackend]);

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

  const handleDailyRateChange = useCallback((rate: number) => {
    if (!isNaN(rate)) {
      const updatedData: Partial<RFTeamMemberNodeData> = { dailyRate: rate };
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
        
        // Also delete connected edges
        const connectedEdges = getNodes().filter((node) => 
          connections.some(conn => conn.source === node.id || conn.target === node.id)
        );
      })
      .catch((error) => {
        console.error('Failed to delete team member node:', error);
        toast.error("Delete Failed: Failed to delete the team member node from the server.");
      });
  }, [id, setNodes, getNodes, connections]);

  // Calculate member summary data
  const memberSummary = useMemo<TeamMemberSummary>(() => ({
    id,
    weeklyCapacity: data.weeklyCapacity || 0,
    dailyRate: data.dailyRate || 0,
    roles: data.roles || [],
    allocation: data.allocation || 0,
    startDate: data.startDate
  }), [
    id,
    data.weeklyCapacity,
    data.dailyRate,
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
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

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
      bioDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

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

  // Add this after the timezone handler
  const handleAllocationChange = useCallback((allocation: number) => {
    const updatedData: Partial<RFTeamMemberNodeData> = { allocation };
    updateNodeData(id, { ...data, ...updatedData });
    
    // Clear any existing debounce timer
    if (allocationDebounceRef.current) {
      clearTimeout(allocationDebounceRef.current);
    }
    
    // Set a new debounce timer
    allocationDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      allocationDebounceRef.current = null;
    }, 1000); // 1 second debounce

    // Also update the team node if connected
    const teamConnection = connections.find(conn => {
      return (conn.source === id && isTeamNode(getNode(conn.target))) || 
             (conn.target === id && isTeamNode(getNode(conn.source)));
    });

    if (teamConnection) {
      const teamNodeId = teamConnection.source === id ? teamConnection.target : teamConnection.source;
      const teamNode = getNode(teamNodeId);
      
      if (isTeamNode(teamNode)) {
        // Ensure roster is an array before using array methods
        const rosterArray = Array.isArray(teamNode.data.roster) ? teamNode.data.roster : [];
        const updatedRoster = rosterArray.map((member: RosterMember) => {
          if (member.memberId === id) {
            return { ...member, allocation };
          }
          return member;
        });
        
        updateNodeData(teamNodeId, {
          ...teamNode.data,
          roster: updatedRoster
        });
        
        // Save the updated roster to the backend using GraphApiClient
        GraphApiClient.updateNode('team', teamNodeId, { roster: updatedRoster });
      }
    }
  }, [id, data, updateNodeData, saveToBackend, connections, getNode]);

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
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (bioDebounceRef.current) clearTimeout(bioDebounceRef.current);
      if (hoursDebounceRef.current) clearTimeout(hoursDebounceRef.current);
      if (daysDebounceRef.current) clearTimeout(daysDebounceRef.current);
      if (rateDebounceRef.current) clearTimeout(rateDebounceRef.current);
      if (startDateDebounceRef.current) clearTimeout(startDateDebounceRef.current);
      if (rolesDebounceRef.current) clearTimeout(rolesDebounceRef.current);
      if (timezoneDebounceRef.current) clearTimeout(timezoneDebounceRef.current);
      if (allocationDebounceRef.current) clearTimeout(allocationDebounceRef.current);
    };
  }, []);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    title: data.title || '',
    bio: data.bio || '',
    roles: data.roles || [],
    timezone: data.timezone || '',
    dailyRate: data.dailyRate || 350,
    hoursPerDay: data.hoursPerDay || 8,
    daysPerWeek: data.daysPerWeek || 5,
    weeklyCapacity: data.weeklyCapacity || 0,
    startDate: data.startDate || DEFAULT_START_DATE,
    allocation: data.allocation || 0,
    memberSummary,
    
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
    handleDailyRateChange,
    handleStartDateChange,
    handleRolesChange,
    handleTimezoneChange,
    handleAllocationChange,
    handleDelete,
    
    // Constants
    TIMEZONES,
    DEFAULT_START_DATE,
    EARLIEST_START_DATE
  }), [
    data.title,
    data.bio,
    data.roles,
    data.timezone,
    data.dailyRate,
    data.hoursPerDay,
    data.daysPerWeek,
    data.weeklyCapacity,
    data.startDate,
    data.allocation,
    memberSummary,
    validateHoursPerDay,
    validateDaysPerWeek,
    validateDailyRate,
    validateStartDate,
    handleTitleChange,
    handleBioChange,
    handleHoursPerDayChange,
    handleDaysPerWeekChange,
    handleDailyRateChange,
    handleStartDateChange,
    handleRolesChange,
    handleTimezoneChange,
    handleAllocationChange,
    handleDelete
  ]);
} 