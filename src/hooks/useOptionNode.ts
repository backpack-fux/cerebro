"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { 
  RFOptionNodeData, 
  Goal, 
  Risk, 
  OptionType,
} from '@/services/graph/option/option.types';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { toast } from "sonner";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus, NodeStatus } from './useNodeStatus';
import { useDurationInput } from './useDurationInput';
import { useResourceAllocation } from '@/hooks/useResourceAllocation';
import { v4 as uuidv4 } from 'uuid';
import { 
  prepareDataForBackend,
  parseDataFromBackend,
  parseJsonIfString
} from '@/utils/utils';
import { isOptionNode } from "@/utils/type-guards";
import { TeamAllocation } from "@/utils/types/allocation";
import { useNodeObserver } from '@/hooks/useNodeObserver';
import { NodeUpdateType, NodeUpdateMetadata } from '@/services/graph/observer/node-observer';
import { useDurationPublishing } from '@/utils/hooks/useDurationPublishing';
import { useMemberAllocationPublishing, NodeDataWithTeamAllocations } from "@/hooks/useMemberAllocationPublishing";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { format } from 'date-fns';
import { calculateEndDate } from '@/utils/time/duration';

// Extend RFOptionNodeData to ensure status is of type NodeStatus
interface ExtendedRFOptionNodeData extends RFOptionNodeData {
  status?: NodeStatus;
}

/**
 * Hook for managing option node state and operations
 * Separates domain logic from React Flow component state
 */
export function useOptionNode(id: string, data: ExtendedRFOptionNodeData) {
  const { updateNodeData, setNodes, getEdges, getNodes } = useReactFlow();
  
  // Initialize node observer
  const { publishUpdate, publishManifestUpdate, subscribeBasedOnManifest } = useNodeObserver<RFOptionNodeData>(id, 'option');
  
  // Define JSON fields that need special handling
  const jsonFields = useMemo(() => ['goals', 'risks', 'teamAllocations', 'memberAllocations'], []);
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFOptionNodeData;
  }, [data, jsonFields]);
  
  // State for option data
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  const [optionType, setOptionType] = useState<OptionType | undefined>(parsedData.optionType || 'customer');
  const [transactionFeeRate, setTransactionFeeRate] = useState<number | undefined>(parsedData.transactionFeeRate);
  const [monthlyVolume, setMonthlyVolume] = useState<number | undefined>(parsedData.monthlyVolume);
  const [goals, setGoals] = useState<Goal[]>(parsedData.goals || []);
  const [risks, setRisks] = useState<Risk[]>(parsedData.risks || []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [teamAllocations, setTeamAllocations] = useState<TeamAllocation[]>(
    Array.isArray(parsedData.teamAllocations) ? parsedData.teamAllocations : []
  );

  // Ensure complex objects are always arrays
  const processedGoals = useMemo(() => {
    return Array.isArray(parsedData.goals) ? parsedData.goals : [];
  }, [parsedData.goals]);
  
  const processedRisks = useMemo(() => {
    return Array.isArray(parsedData.risks) ? parsedData.risks : [];
  }, [parsedData.risks]);
  
  const processedTeamMembers = useMemo(() => {
    return Array.isArray(parsedData.teamMembers) ? parsedData.teamMembers : [];
  }, [parsedData.teamMembers]);
  
  const processedMemberAllocations = useMemo(() => {
    return Array.isArray(parsedData.memberAllocations) ? parsedData.memberAllocations : [];
  }, [parsedData.memberAllocations]);
  
  // Ensure teamAllocations is always an array for UI rendering
  const processedTeamAllocations = useMemo(() => {
    return parseJsonIfString<TeamAllocation[]>(parsedData.teamAllocations, []);
  }, [parsedData.teamAllocations]);

  // Create a safe copy of the data for hooks
  const safeOptionData = useMemo(() => ({
    ...parsedData,
    goals: processedGoals,
    risks: processedRisks,
    teamMembers: processedTeamMembers,
    memberAllocations: processedMemberAllocations,
    teamAllocations: processedTeamAllocations
  }), [parsedData, processedGoals, processedRisks, processedTeamMembers, processedMemberAllocations, processedTeamAllocations]);

  // Use the standardized member allocation publishing hook
  const allocationPublishing = useMemberAllocationPublishing(
    id,
    'option',
    safeOptionData as NodeDataWithTeamAllocations,
    publishManifestUpdate as (
      data: Partial<RFOptionNodeData>,
      fieldIds: string[],
      metadata?: Partial<NodeUpdateMetadata>
    ) => void,
    {
      fieldName: 'teamAllocations',
      debugName: 'OptionNode'
    }
  );

  // Refs for updating state
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const transactionFeeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const monthlyVolumeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });
  const defaultOptionTypeSetRef = useRef<boolean>(false);
  
  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, data);
  
  // Add a saveTeamAllocationsToBackend function that delegates to allocationPublishing for compatibility
  const saveTeamAllocationsToBackend = useCallback((teamAllocations: TeamAllocation[]): Promise<boolean> => {
    console.log(`[OptionNode][${id}] 🔄 saveTeamAllocationsToBackend called with ${teamAllocations.length} allocations`);
    return allocationPublishing.saveToBackendAsync(teamAllocations);
  }, [allocationPublishing, id]);

  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.processedTeamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costs = teamAllocationHook.costs;
  
  // Use the resource allocation hook to manage resource allocations with standardized publishing
  const resourceAllocation = useResourceAllocation(
    id,
    'option',
    safeOptionData,
    teamAllocationHook,
    getNodes,
    publishManifestUpdate as (
      data: Partial<RFOptionNodeData>,
      fieldIds: string[],
      metadata?: Partial<NodeUpdateMetadata>
    ) => void
  );

  // Use the node status hook to manage status
  const { status, getStatusColor, cycleStatus: originalCycleStatus } = useNodeStatus(
    id, 
    data, 
    updateNodeData, 
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );

  // Wrap the cycleStatus function to publish updates when status changes
  const cycleStatus = useCallback((e: React.MouseEvent) => {
    // Call the original function to update the status
    originalCycleStatus(e);
    
    // Get the current status after the update
    const currentStatus = data.status || 'planning';
    
    // Publish the status update to subscribers
    publishManifestUpdate(
      { ...safeOptionData, status: currentStatus },
      ['status']
    );
  }, [originalCycleStatus, publishManifestUpdate, safeOptionData, data.status]);
  
  // Use the duration input hook to manage timeToClose
  const timeToClose = useDurationInput(
    id, 
    data, 
    updateNodeData,
    {
      maxDays: 180,
      label: 'Time to Close',
      fieldName: 'timeToClose',
      tip: 'Estimated time to close this option',
    }
  );
  
  // Use the standardized duration publishing hooks
  const durationPublishing = useDurationPublishing(
    id, 
    'option', 
    safeOptionData, 
    publishManifestUpdate,
    { 
      fieldName: 'duration',
      debugName: 'OptionNode'
    }
  );
  
  const buildDurationPublishing = useDurationPublishing(
    id, 
    'option', 
    safeOptionData, 
    publishManifestUpdate,
    { 
      fieldName: 'buildDuration',
      debugName: 'OptionNode'
    }
  );
  
  const timeToClosePublishing = useDurationPublishing(
    id, 
    'option', 
    safeOptionData, 
    publishManifestUpdate,
    { 
      fieldName: 'timeToClose',
      debugName: 'OptionNode'
    }
  );
  
  // Override the duration change handlers
  const handleTimeToCloseChange = useCallback((value: string) => {
    timeToClosePublishing.handleDurationChange(value, timeToClose.handleDurationChange);
  }, [timeToClose.handleDurationChange, timeToClosePublishing]);
  
  // Add the custom handler to the timeToClose object
  const enhancedTimeToClose = useMemo(() => ({
    ...timeToClose,
    handleDurationChange: handleTimeToCloseChange
  }), [timeToClose, handleTimeToCloseChange]);
  
  // Save duration fields to backend when they change
  useEffect(() => {
    if (data.timeToClose !== undefined) {
      return timeToClosePublishing.saveToBackend();
    }
  }, [data.timeToClose, timeToClosePublishing]);
  
  useEffect(() => {
    if (data.duration !== undefined) {
      return durationPublishing.saveToBackend();
    }
  }, [data.duration, durationPublishing]);
  
  useEffect(() => {
    if (data.buildDuration !== undefined) {
      return buildDurationPublishing.saveToBackend();
    }
  }, [data.buildDuration, buildDurationPublishing]);

  // Add an effect to save team allocations when they change
  useEffect(() => {
    // Use the parseJsonIfString utility to ensure we have a proper array
    const teamAllocations = parseJsonIfString<TeamAllocation[]>(data.teamAllocations, []);
    
    // Use the allocation publishing hook to handle saving
    if (teamAllocations.length > 0) {
      console.log(`[OptionNode][${id}] 💾 Saving team allocations:`, teamAllocations);
      
      // Only save if we actually have allocations
      return allocationPublishing.saveToBackend(teamAllocations);
    }
  }, [data.teamAllocations, allocationPublishing, id]);

  // Subscribe to updates from other nodes based on manifest
  useEffect(() => {
    if (!id) return;
    
    const { unsubscribe } = subscribeBasedOnManifest();
    
    // Listen for node data updates
    const handleNodeDataUpdated = (event: CustomEvent) => {
      const { subscriberId, publisherType, publisherId, relevantFields, data: publisherData } = event.detail;
      
      if (subscriberId !== id) return;
      
      // Combine all publishing hooks to create a comprehensive check
      const relevantDurationFields = relevantFields.filter((field: string) => 
        ['duration', 'buildDuration', 'timeToClose'].includes(field)
      );
      
      const isDurationUpdate = relevantDurationFields.length > 0;
      
      // Skip duration updates that could cause loops
      if (isDurationUpdate) {
        // Check with the appropriate publishing hook
        if (relevantFields.includes('duration') && 
            !durationPublishing.shouldProcessUpdate(publisherId, relevantFields)) {
          return;
        }
        
        if (relevantFields.includes('buildDuration') && 
            !buildDurationPublishing.shouldProcessUpdate(publisherId, relevantFields)) {
          return;
        }
        
        if (relevantFields.includes('timeToClose') && 
            !timeToClosePublishing.shouldProcessUpdate(publisherId, relevantFields)) {
          return;
        }
      }
      
      // Skip allocation updates that could cause loops or that come from the allocation publishing system
      if (relevantFields.includes('teamAllocations') &&
          !allocationPublishing.shouldProcessUpdate(publisherId, relevantFields)) {
        console.log(`[OptionNode][${id}] 🚫 Skipping potential allocation update loop from ${publisherId}`);
        return;
      }
      
      console.log(`Option node ${id} received update from ${publisherType} ${publisherId}:`, {
        relevantFields,
        publisherData
      });
      
      // Handle updates based on publisher type and relevant fields
      switch (publisherType) {
        case 'team':
          // Handle team updates
          if (relevantFields.includes('title') || relevantFields.includes('roster') || relevantFields.includes('bandwidth')) {
            // Refresh team allocations if team data changes
            // DO NOT overwrite the entire teamAllocations array, only update relevant parts
            if (teamAllocationsFromHook.length > 0) {
              const updatedTeamAllocations = teamAllocationsFromHook.map((allocation: TeamAllocation) => {
                if (allocation.teamId === publisherId) {
                  // Create an updated allocation with the new team data
                  // Only update properties that exist on the TeamAllocation type
                  return {
                    ...allocation,
                    // Custom properties might be stored in the allocatedMembers or as custom properties
                    // We'll update what we can safely
                    requestedHours: allocation.requestedHours
                  };
                }
                return allocation;
              });
              
              // IMPORTANT: Preserve member allocations by checking if we actually have changes
              const hasChanges = JSON.stringify(updatedTeamAllocations) !== JSON.stringify(teamAllocationsFromHook);
              
              if (hasChanges) {
                console.log(`[OptionNode][${id}] 🔄 Updating team data for ${publisherId}`, updatedTeamAllocations);
                
                // Update React Flow state
                updateNodeData(id, { teamAllocations: updatedTeamAllocations });
                
                // Update local state
                setTeamAllocations(updatedTeamAllocations);
              } else {
                console.log(`[OptionNode][${id}] ✓ No changes needed for team ${publisherId}`);
              }
            }
          }
          break;
          
        case 'teamMember':
          // Handle team member updates
          if (relevantFields.includes('title') || relevantFields.includes('weeklyCapacity') || relevantFields.includes('dailyRate')) {
            // Update team allocations if they contain this team member
            if (teamAllocationsFromHook.length > 0) {
              // Check if any allocation has this member before making updates
              const hasMember = teamAllocationsFromHook.some((allocation: TeamAllocation) => 
                allocation.allocatedMembers?.some(m => m.memberId === publisherId)
              );
              
              if (hasMember) {
                const updatedTeamAllocations = teamAllocationsFromHook.map((allocation: TeamAllocation) => {
                  // Check if this allocation has the updated member
                  const hasUpdatedMember = allocation.allocatedMembers?.some(
                    member => member.memberId === publisherId
                  );
                  
                  if (hasUpdatedMember) {
                    // Update the member information
                    const updatedMembers = allocation.allocatedMembers?.map(member => {
                      if (member.memberId === publisherId) {
                        return {
                          ...member,
                          name: publisherData.title || member.name
                        };
                      }
                      return member;
                    });
                    
                    return {
                      ...allocation,
                      allocatedMembers: updatedMembers
                    };
                  }
                  
                  return allocation;
                });
                
                // Only update if there are actual changes
                const hasChanges = JSON.stringify(updatedTeamAllocations) !== JSON.stringify(teamAllocationsFromHook);
                
                if (hasChanges) {
                  console.log(`[OptionNode][${id}] 🔄 Updating team member ${publisherId}`, updatedTeamAllocations);
                  
                  // Update React Flow state
                  updateNodeData(id, { teamAllocations: updatedTeamAllocations });
                  
                  // Update local state
                  setTeamAllocations(updatedTeamAllocations);
                } else {
                  console.log(`[OptionNode][${id}] ✓ No changes needed for team member ${publisherId}`);
                }
              }
            }
          }
          break;
          
        case 'feature':
        case 'provider':
          // Handle feature or provider updates that might affect this option
          if (relevantFields.includes('duration') || relevantFields.includes('buildType') || relevantFields.includes('costs')) {
            // These updates might affect the option's calculations
            // You could trigger a refresh or update specific calculations
            console.log(`Received update from ${publisherType} that might affect calculations`);
          }
          break;
      }
    };
    
    window.addEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    };
  }, [id, subscribeBasedOnManifest, durationPublishing, buildDurationPublishing, timeToClosePublishing, allocationPublishing, resourceAllocation, teamAllocationsFromHook, updateNodeData]);

  // Create a more robust saveToBackend that carefully preserves allocations
  const saveToBackend = useCallback(async (updates: Partial<RFOptionNodeData>) => {
    try {
      if (updates === null || Object.keys(updates).length === 0) {
        console.log(`[OptionNode][${id}] Skipping save - no updates`);
        return false;
      }

      console.log(`[OptionNode][${id}] 💾 Saving node:`, updates);
      const updatesForBackend = { ...updates };

      // Create a defensive deep copy of team allocations if they exist
      if (updates.teamAllocations) {
        try {
          const allocationsString = typeof updates.teamAllocations === 'string' 
            ? updates.teamAllocations 
            : JSON.stringify(updates.teamAllocations);
          
          const backupAllocations = JSON.parse(allocationsString);
          console.log(`[OptionNode][${id}] 🛡️ Created backup of ${backupAllocations.length} team allocations`);
          
          // Store a backup of allocations (helps debug and can be used for recovery)
          localStorage.setItem(`option_allocations_backup_${id}`, allocationsString);
        } catch (e) {
          console.error(`[OptionNode][${id}] Failed to create backup of allocations`, e);
        }
      }

      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updatesForBackend, jsonFields);

      // Send to backend
      await GraphApiClient.updateNode('option', id, apiData);

      // Update React Flow state with the original object data (not stringified)
      updateNodeData(id, updatesForBackend);

      // Determine which fields were updated
      const updatedFields = Object.keys(updates);
      if (updatedFields.length > 0) {
        console.log(`[OptionNode][${id}] ✅ Updated fields: ${updatedFields.join(', ')}`);
        
        // Publish the update to subscribers
        const updatedData = { ...parsedData, ...updates };
        publishManifestUpdate(updatedData, updatedFields);
      }
      
      return true;
    } catch (error) {
      console.error(`[OptionNode][${id}] 🔴 Error saving node:`, error);
      
      // If we have a backup of allocations, we could try to recover here
      const backupAllocations = localStorage.getItem(`option_allocations_backup_${id}`);
      if (backupAllocations && updates.teamAllocations) {
        console.log(`[OptionNode][${id}] 🔄 Allocation backup available, could restore ${backupAllocations.length} characters`);
      }
      
      toast.error('Failed to save option data');
      return false;
    }
  }, [id, jsonFields, updateNodeData, parsedData, publishManifestUpdate]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    // First update the local state
    setTitle(newTitle);
    
    // Then update the node data in ReactFlow
    updateNodeData(id, { ...safeOptionData, title: newTitle });
    
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ title: newTitle });
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    updateNodeData(id, { ...safeOptionData, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ description: newDescription });
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Add functionality to create, update, and remove goals
  const addGoal = useCallback(() => {
    setGoals(prevGoals => {
      const newGoal: Goal = {
        id: uuidv4(),
        description: '',
        impact: 'medium'
      };
      return [...prevGoals, newGoal];
    });
    
    // Publish the update
    publishManifestUpdate(
      { ...safeOptionData, goals: [...goals, { id: uuidv4(), description: '', impact: 'medium' }] },
      ['goals']
    );
  }, [publishManifestUpdate, safeOptionData, goals]);
  
  const removeGoal = useCallback((goalId: string) => {
    setGoals(prevGoals => prevGoals.filter(goal => goal.id !== goalId));
    
    // Publish the update
    publishManifestUpdate(
      { ...safeOptionData, goals: goals.filter(goal => goal.id !== goalId) },
      ['goals']
    );
  }, [publishManifestUpdate, safeOptionData, goals]);
  
  const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
    setGoals(prevGoals => 
      prevGoals.map(goal => 
        goal.id === goalId ? { ...goal, ...updates } : goal
      )
    );
    
    // Publish the update
    publishManifestUpdate(
      { 
        ...safeOptionData, 
        goals: goals.map(goal => goal.id === goalId ? { ...goal, ...updates } : goal) 
      },
      ['goals']
    );
  }, [publishManifestUpdate, safeOptionData, goals]);
  
  // Add functionality to create, update, and remove risks
  const addRisk = useCallback(() => {
    setRisks(prevRisks => {
      const newRisk: Risk = {
        id: uuidv4(),
        description: '',
        severity: 'medium'
      };
      return [...prevRisks, newRisk];
    });
    
    // Publish the update
    publishManifestUpdate(
      { ...safeOptionData, risks: [...risks, { id: uuidv4(), description: '', severity: 'medium' }] },
      ['risks']
    );
  }, [publishManifestUpdate, safeOptionData, risks]);
  
  const removeRisk = useCallback((riskId: string) => {
    setRisks(prevRisks => prevRisks.filter(risk => risk.id !== riskId));
    
    // Publish the update
    publishManifestUpdate(
      { ...safeOptionData, risks: risks.filter(risk => risk.id !== riskId) },
      ['risks']
    );
  }, [publishManifestUpdate, safeOptionData, risks]);
  
  const updateRisk = useCallback((riskId: string, updates: Partial<Risk>) => {
    setRisks(prevRisks => 
      prevRisks.map(risk => 
        risk.id === riskId ? { ...risk, ...updates } : risk
      )
    );
    
    // Publish the update
    publishManifestUpdate(
      { 
        ...safeOptionData, 
        risks: risks.map(risk => risk.id === riskId ? { ...risk, ...updates } : risk) 
      },
      ['risks']
    );
  }, [publishManifestUpdate, safeOptionData, risks]);

  // Delete the node
  const handleDelete = useCallback(() => {
    // Delete the node from the backend
    GraphApiClient.deleteNode('option' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete connected edges
        const connectedEdges = getEdges().filter((edge) => edge.source === id || edge.target === id);
        connectedEdges.forEach((edge) => {
          GraphApiClient.deleteEdge('option' as NodeType, edge.id)
            .catch((error) => console.error('Failed to delete edge:', error));
        });
      })
      .catch((error) => {
        console.error('Failed to delete option node:', error);
        toast.error("Delete Failed: Failed to delete the option node from the server.");
      });
  }, [id, setNodes, getEdges]);

  // Handle option type change
  const handleOptionTypeChange = useCallback((value: OptionType) => {
    setOptionType(value);
    updateNodeData(id, { ...safeOptionData, optionType: value });
    saveToBackend({ optionType: value });
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle transaction fee change
  const handleTransactionFeeChange = useCallback((value: number) => {
    if (!isNaN(value) && value >= 0 && value <= 100) {
      // Update local state immediately for responsive UI
      setTransactionFeeRate(value);
      
      // Update ReactFlow state
      updateNodeData(id, { ...safeOptionData, transactionFeeRate: value });
      
      // Debounce the backend save to prevent too many requests
      if (transactionFeeDebounceRef.current) {
        clearTimeout(transactionFeeDebounceRef.current);
      }
      
      transactionFeeDebounceRef.current = setTimeout(() => {
        saveToBackend({ transactionFeeRate: value });
        transactionFeeDebounceRef.current = null;
      }, 500);
    }
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle monthly volume change
  const handleMonthlyVolumeChange = useCallback((value: number) => {
    if (!isNaN(value) && value >= 0) {
      // Update local state immediately for responsive UI
      setMonthlyVolume(value);
      
      // Update ReactFlow state
      updateNodeData(id, { ...safeOptionData, monthlyVolume: value });
      
      // Debounce the backend save to prevent too many requests
      if (monthlyVolumeDebounceRef.current) {
        clearTimeout(monthlyVolumeDebounceRef.current);
      }
      
      monthlyVolumeDebounceRef.current = setTimeout(() => {
        saveToBackend({ monthlyVolume: value });
        monthlyVolumeDebounceRef.current = null;
      }, 500);
    }
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Calculate expected monthly value
  const expectedMonthlyValue = useMemo(() => {
    if (safeOptionData.transactionFeeRate && safeOptionData.monthlyVolume) {
      return (safeOptionData.transactionFeeRate / 100) * safeOptionData.monthlyVolume;
    }
    return 0;
  }, [safeOptionData.transactionFeeRate, safeOptionData.monthlyVolume]);

  // Calculate payoff details
  const payoffDetails = useMemo(() => {
    if (!expectedMonthlyValue || !costs.totalCost || expectedMonthlyValue === 0) {
      return null;
    }

    const totalCost = costs.totalCost;
    const monthsToPayoff = totalCost / expectedMonthlyValue;
    
    return {
      monthsToPayoff,
      yearsToPayoff: monthsToPayoff / 12,
      isPayoffPossible: expectedMonthlyValue > 0
    };
  }, [expectedMonthlyValue, costs.totalCost]);

  // Fix for teamAllocationsDebounceRef cleanup
  useEffect(() => {
    // Store the current ref value in a variable
    const currentRef = teamAllocationsDebounceRef.current;
    
    return () => {
      if (currentRef && currentRef.timeout) {
        clearTimeout(currentRef.timeout);
      }
    };
  }, []);

  // Set default option type if not already set
  useEffect(() => {
    // Only run this effect once
    if (!defaultOptionTypeSetRef.current && data.optionType === undefined) {
      defaultOptionTypeSetRef.current = true;
      
      // Set default option type to 'customer'
      const defaultOptionType: OptionType = 'customer';
      console.log('Setting default option type to customer');
      updateNodeData(id, { ...data, optionType: defaultOptionType });
      saveToBackend({ optionType: defaultOptionType });
    }
  }, [id, data, updateNodeData, saveToBackend]);

  // Function to refresh data from the server
  const refreshData = useCallback(async () => {
    console.log(`🔄 Manually refreshing option data for ${id}`);
    
    try {
      // Check if this is a known blacklisted node
      if (GraphApiClient.isNodeBlacklisted(id)) {
        console.warn(`🚫 Skipping refresh for blacklisted node ${id}`);
        return;
      }
      
      // Verify that we're working with an option node
      const nodeFromGraph = getNodes().find(n => n.id === id);
      if (nodeFromGraph && !isOptionNode(nodeFromGraph)) {
        console.warn(`Node ${id} exists but is not an option node. Type: ${nodeFromGraph.type}`);
        return;
      }
      
      // Use the GraphApiClient to fetch node data
      const serverData = await GraphApiClient.getNode('option' as NodeType, id);
      
      // Type-check and assert the shape of the returned data
      if (!serverData || typeof serverData !== 'object') {
        throw new Error('Invalid server data received');
      }
      
      // Create a properly typed server data object
      const typedServerData = serverData as {
        title?: string;
        description?: string;
        optionType?: OptionType;
        transactionFeeRate?: number;
        monthlyVolume?: number;
        goals?: string | Goal[];
        risks?: string | Risk[];
        teamAllocations?: string | TeamAllocation[];
        duration?: number;
        buildDuration?: number;
        timeToClose?: number;
        status?: string;
      };
      
      console.log(`🚀 Server returned refreshed data for ${id}:`, serverData);
      
      // Process the data from the server
      const processedData = parseDataFromBackend({
        title: typedServerData.title,
        description: typedServerData.description,
        optionType: typedServerData.optionType,
        transactionFeeRate: typedServerData.transactionFeeRate,
        monthlyVolume: typedServerData.monthlyVolume,
        goals: typedServerData.goals,
        risks: typedServerData.risks,
        teamAllocations: typedServerData.teamAllocations,
        duration: typedServerData.duration,
        buildDuration: typedServerData.buildDuration,
        timeToClose: typedServerData.timeToClose,
        status: typedServerData.status
      }, jsonFields) as RFOptionNodeData;
      
      // Update local state with all server data
      setTitle(processedData.title || '');
      setDescription(processedData.description || '');
      setOptionType(processedData.optionType as OptionType || undefined);
      setTransactionFeeRate(processedData.transactionFeeRate || undefined);
      setMonthlyVolume(processedData.monthlyVolume || undefined);
      
      // Update goals and risks
      if (Array.isArray(processedData.goals)) {
        setGoals(processedData.goals);
      }
      
      if (Array.isArray(processedData.risks)) {
        setRisks(processedData.risks);
      }
      
      // Process team allocations
      const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(processedData.teamAllocations, []);
      setTeamAllocations(processedTeamAllocations);
      
      // Update node data in ReactFlow
      const updatedData = {
        ...data,
        title: processedData.title || data.title,
        description: processedData.description || data.description,
        optionType: processedData.optionType || data.optionType,
        transactionFeeRate: processedData.transactionFeeRate || data.transactionFeeRate,
        monthlyVolume: processedData.monthlyVolume || data.monthlyVolume,
        teamAllocations: processedTeamAllocations,
        goals: processedData.goals || data.goals,
        risks: processedData.risks || data.risks,
        duration: processedData.duration || data.duration,
        buildDuration: processedData.buildDuration || data.buildDuration,
        timeToClose: processedData.timeToClose || data.timeToClose
      };
      
      // Update ReactFlow state
      updateNodeData(id, updatedData);
      
      // Publish a complete update to all subscribers
      publishUpdate(updatedData, {
        updateType: NodeUpdateType.CONTENT,
        source: 'refresh'
      });
      
      console.log('✅ Successfully refreshed option data');
      
    } catch (error) {
      console.error(`❌ Error refreshing node data for ${id}:`, error);
      toast.error(`Failed to refresh option ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, data, updateNodeData, getNodes, jsonFields, publishUpdate]);

  // Add date handling functions
  const updateStartDate = useCallback((newStartDate: string) => {
    // Calculate end date based on start date and duration
    const currentDuration = data.duration || 0;
    const endDate = calculateEndDate(new Date(newStartDate), currentDuration);

    // Update node data
    updateNodeData(id, {
      ...safeOptionData,
      startDate: newStartDate,
      endDate
    });

    // Save dates to backend
    const apiData = prepareDataForBackend({ 
      startDate: newStartDate,
      endDate
    }, []);

    GraphApiClient.updateNode('option' as NodeType, id, apiData)
      .then(() => {
        // Publish the update
        publishManifestUpdate(
          { ...safeOptionData, startDate: newStartDate, endDate },
          ['startDate', 'endDate']
        );
      })
      .catch((error) => {
        console.error(`[OptionNode][${id}] Failed to update dates:`, error);
        toast.error('Failed to update dates');
      });
  }, [id, data.duration, safeOptionData, updateNodeData, publishManifestUpdate]);

  const updateEndDate = useCallback((newEndDate: string) => {
    // Update node data
    updateNodeData(id, {
      ...safeOptionData,
      endDate: newEndDate
    });

    // Save end date to backend
    const apiData = prepareDataForBackend({ 
      endDate: newEndDate
    }, []);

    GraphApiClient.updateNode('option' as NodeType, id, apiData)
      .then(() => {
        // Publish the update
        publishManifestUpdate(
          { ...safeOptionData, endDate: newEndDate },
          ['endDate']
        );
      })
      .catch((error) => {
        console.error(`[OptionNode][${id}] Failed to update end date:`, error);
        toast.error('Failed to update end date');
      });
  }, [id, safeOptionData, updateNodeData, publishManifestUpdate]);

  // Set up subscribers for node data manifests
  useEffect(() => {
    // Subscribe to manifest updates from connected nodes
    subscribeBasedOnManifest();
    
    return () => {
      // No cleanup needed, handled by the hook
    };
  }, [subscribeBasedOnManifest, allocationPublishing]);

  // Protect team allocations - ensure they are always properly parsed
  useEffect(() => {
    if (processedTeamAllocations && processedTeamAllocations.length > 0) {
      // Check if we need to ensure the team allocations are saved
      const currentAllocationsStr = typeof parsedData.teamAllocations === 'string'
        ? parsedData.teamAllocations
        : JSON.stringify(parsedData.teamAllocations || []);
      
      const processedAllocationsStr = JSON.stringify(processedTeamAllocations);
      
      // Only save if there's a difference to avoid loops
      if (currentAllocationsStr !== processedAllocationsStr) {
        console.log(`[OptionNode][${id}] 🔄 Synchronizing team allocations from processed data`);
        console.log(`[OptionNode][${id}] ↪️ Current allocations: ${currentAllocationsStr}`);
        console.log(`[OptionNode][${id}] ↪️ Processed allocations: ${processedAllocationsStr}`);
        
        // Use a small delay to avoid race conditions with other saves
        const timer = setTimeout(() => {
          // Need to use the actual TeamAllocation[] type, not the string
          saveToBackend({
            teamAllocations: processedTeamAllocations
          });
        }, 800);
        
        return () => clearTimeout(timer);
      }
    }
  }, [id, processedTeamAllocations, parsedData.teamAllocations, saveToBackend]);

  // Return the hook API
  return {
    title,
    description,
    optionType: optionType || 'customer',
    transactionFeeRate: transactionFeeRate || 0,
    monthlyVolume: monthlyVolume || 0,
    expectedMonthlyValue: expectedMonthlyValue,
    timeToClose: enhancedTimeToClose,
    payoffDetails,
    status,
    getStatusColor,
    cycleStatus,
    goals: processedGoals,
    risks: processedRisks,
    
    // Dates
    startDate: parsedData.startDate || '',
    endDate: parsedData.endDate || '',
    updateStartDate,
    updateEndDate,
    
    // Event handlers
    handleTitleChange,
    handleDescriptionChange,
    handleOptionTypeChange,
    handleTransactionFeeChange,
    handleMonthlyVolumeChange,
    handleDelete,
    
    // Resource management
    connectedTeams,
    processedTeamAllocations,
    
    // Resource allocation handlers - copied directly from useProviderNode.ts
    handleAllocationChangeLocal: resourceAllocation.handleAllocationChangeLocal,
    handleAllocationCommit: resourceAllocation.handleAllocationCommit,
    calculateMemberAllocations: resourceAllocation.calculateMemberAllocations,
    calculateCostSummary: resourceAllocation.calculateCostSummary,
    requestTeamAllocation: teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    
    // Data operations
    refreshData,
    
    // Goal and risk management
    addGoal,
    removeGoal,
    updateGoal,
    addRisk,
    removeRisk,
    updateRisk,
    
    // Expose allocation publishing for loading indicator
    allocationPublishing
  };
} 