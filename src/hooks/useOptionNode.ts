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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [goals, setGoals] = useState<Goal[]>(parsedData.goals || []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Refs for updating state
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const transactionFeeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const monthlyVolumeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });
  const defaultOptionTypeSetRef = useRef<boolean>(false);
  
  // Add ref for tracking team allocation updates
  const isTeamAllocationUpdatingRef = useRef<boolean>(false);
  
  // Save team allocations to backend
  const saveTeamAllocationsToBackend = useCallback((teamAllocations: TeamAllocation[]): Promise<boolean> => {
    // Skip if we're already updating
    if (isTeamAllocationUpdatingRef.current) {
      console.log(`[OptionNode][${id}] Skipping save to backend - already updating`);
      return Promise.resolve(false);
    }

    // Set flag to prevent circular updates during save
    isTeamAllocationUpdatingRef.current = true;

    // Update local state immediately to avoid flicker
    const updatedData = {
      ...safeOptionData,
      teamAllocations
    };
    
    // Update node data right away to prevent UI flicker
    updateNodeData(id, updatedData);
    
    // Log the team allocations before sending to backend
    console.log('Team allocations being sent to backend:', JSON.stringify(teamAllocations, null, 2));
    
    try {
      // Prepare data for backend
      const apiData = prepareDataForBackend({ teamAllocations }, jsonFields);
      
      // Return a promise that resolves when the operation completes
      return GraphApiClient.updateNode('option' as NodeType, id, apiData)
        .then(() => {
          // Publish the update to subscribers
          publishManifestUpdate(
            { ...safeOptionData, teamAllocations },
            ['teamAllocations', 'teamAllocationTeamId', 'teamAllocationRequestedHours', 'teamAllocationMembers']
          );
          
          console.log('✅ Successfully saved team allocations to backend');
          return true;
        })
        .catch((error) => {
          console.error('❌ Failed to save team allocations to backend:', error);
          toast.error('Failed to save team allocations');
          return false;
        })
        .finally(() => {
          // Reset updating flag after a delay to allow state to settle
          setTimeout(() => {
            isTeamAllocationUpdatingRef.current = false;
            console.log(`[OptionNode][${id}] Reset updating flag after save`);
          }, 300);
        });
    } catch (error) {
      console.error('❌ Error preparing team allocations data:', error);
      isTeamAllocationUpdatingRef.current = false;
      return Promise.resolve(false);
    }
  }, [id, jsonFields, updateNodeData, publishManifestUpdate, safeOptionData]);

  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, data);
  
  // Add the saveTeamAllocationsToBackend function to the teamAllocationHook
  const enhancedTeamAllocationHook = teamAllocationHook as unknown as typeof teamAllocationHook & {
    saveTeamAllocationsToBackend: typeof saveTeamAllocationsToBackend
  };
  enhancedTeamAllocationHook.saveTeamAllocationsToBackend = saveTeamAllocationsToBackend;
  
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
      
      // Skip allocation updates that could cause loops
      if (relevantFields.includes('teamAllocations') &&
          !resourceAllocation.shouldProcessUpdate(publisherId, relevantFields)) {
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
            
            // Update React Flow state
            updateNodeData(id, { teamAllocations: updatedTeamAllocations });
            
            // Update local state
            setTeamAllocations(updatedTeamAllocations);
          }
          break;
          
        case 'teamMember':
          // Handle team member updates
          if (relevantFields.includes('title') || relevantFields.includes('weeklyCapacity') || relevantFields.includes('dailyRate')) {
            // Update team allocations if they contain this team member
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
            
            // Update React Flow state
            updateNodeData(id, { teamAllocations: updatedTeamAllocations });
            
            // Update local state
            setTeamAllocations(updatedTeamAllocations);
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
  }, [id, subscribeBasedOnManifest, durationPublishing, buildDurationPublishing, timeToClosePublishing, resourceAllocation, teamAllocationsFromHook, updateNodeData]);

  // Update the saveToBackend function to use the observer system
  const saveToBackend = useCallback(async (updates: Partial<RFOptionNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('option' as NodeType, id, apiData);
      
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
      console.error('Error saving option node:', error);
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

  // Add a new goal
  const addGoal = useCallback(() => {
    const newGoal: Goal = {
      id: `goal-${uuidv4()}`,
      description: '',
      impact: 'medium'
    };
    const updatedGoals = [...processedGoals, newGoal];
    updateNodeData(id, { 
      ...safeOptionData, 
      goals: updatedGoals
    });
    saveToBackend({ goals: updatedGoals });
  }, [id, safeOptionData, processedGoals, updateNodeData, saveToBackend]);

  // Update an existing goal
  const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
    const updatedGoals = processedGoals.map(goal => 
      goal.id === goalId ? { ...goal, ...updates } : goal
    );
    updateNodeData(id, {
      ...safeOptionData,
      goals: updatedGoals
    });
    saveToBackend({ goals: updatedGoals });
  }, [id, safeOptionData, processedGoals, updateNodeData, saveToBackend]);

  // Remove a goal
  const removeGoal = useCallback((goalId: string) => {
    const updatedGoals = processedGoals.filter(goal => goal.id !== goalId);
    updateNodeData(id, {
      ...safeOptionData,
      goals: updatedGoals
    });
    saveToBackend({ goals: updatedGoals });
  }, [id, safeOptionData, processedGoals, updateNodeData, saveToBackend]);

  // Add a new risk
  const addRisk = useCallback(() => {
    const newRisk: Risk = {
      id: `risk-${uuidv4()}`,
      description: '',
      severity: 'medium'
    };
    const updatedRisks = [...processedRisks, newRisk];
    updateNodeData(id, { 
      ...safeOptionData, 
      risks: updatedRisks
    });
    saveToBackend({ risks: updatedRisks });
  }, [id, safeOptionData, processedRisks, updateNodeData, saveToBackend]);

  // Update an existing risk
  const updateRisk = useCallback((riskId: string, updates: Partial<Risk>) => {
    const updatedRisks = processedRisks.map(risk => 
      risk.id === riskId ? { ...risk, ...updates } : risk
    );
    updateNodeData(id, {
      ...safeOptionData,
      risks: updatedRisks
    });
    saveToBackend({ risks: updatedRisks });
  }, [id, safeOptionData, processedRisks, updateNodeData, saveToBackend]);

  // Remove a risk
  const removeRisk = useCallback((riskId: string) => {
    const updatedRisks = processedRisks.filter(risk => risk.id !== riskId);
    updateNodeData(id, {
      ...safeOptionData,
      risks: updatedRisks
    });
    saveToBackend({ risks: updatedRisks });
  }, [id, safeOptionData, processedRisks, updateNodeData, saveToBackend]);

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

  // Return the hook API
  return useMemo(() => ({
    // State
    title,
    description,
    optionType,
    transactionFeeRate,
    monthlyVolume,
    status,
    processedGoals,
    processedRisks,
    processedTeamAllocations: teamAllocationsFromHook,
    connectedTeams,
    costs,
    expectedMonthlyValue,
    payoffDetails,
    
    // Handlers
    handleTitleChange,
    handleDescriptionChange,
    handleOptionTypeChange,
    handleTransactionFeeChange,
    handleMonthlyVolumeChange,
    handleDelete,
    refreshData,
    
    requestTeamAllocation: teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    
    // Goal handlers
    addGoal,
    updateGoal,
    removeGoal,
    
    // Risk handlers
    addRisk,
    updateRisk,
    removeRisk,
    
    // Status
    getStatusColor,
    cycleStatus,
  
    // Time to Close
    timeToClose: enhancedTimeToClose,
    
    // Resource allocation
    handleAllocationChangeLocal: resourceAllocation.handleAllocationChangeLocal,
    handleAllocationCommit: resourceAllocation.handleAllocationCommit,
    calculateMemberAllocations: resourceAllocation.calculateMemberAllocations,
    calculateCostSummary: resourceAllocation.calculateCostSummary,
  }), [
    title,
    description,
    optionType,
    transactionFeeRate,
    monthlyVolume,
    status,
    processedGoals,
    processedRisks,
    teamAllocationsFromHook,
    connectedTeams,
    costs,
    expectedMonthlyValue,
    payoffDetails,
    handleTitleChange,
    handleDescriptionChange,
    handleOptionTypeChange,
    handleTransactionFeeChange,
    handleMonthlyVolumeChange,
    handleDelete,
    refreshData,
    teamAllocationHook.requestTeamAllocation,
    saveTeamAllocationsToBackend,
    addGoal,
    updateGoal,
    removeGoal,
    addRisk,
    updateRisk,
    removeRisk,
    getStatusColor,
    cycleStatus,
    enhancedTimeToClose,
    resourceAllocation,
  ]);
} 