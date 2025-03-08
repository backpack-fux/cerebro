"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { 
  RFOptionNodeData, 
  Goal, 
  Risk, 
  OptionType,
  TeamAllocation
} from '@/services/graph/option/option.types';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { toast } from "sonner";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for managing option node state and operations
 * Separates domain logic from React Flow component state
 */
export function useOptionNode(id: string, data: RFOptionNodeData) {
  const { updateNodeData, setNodes, setEdges, getEdges } = useReactFlow();
  
  // Ensure complex objects are always arrays
  const processedGoals = useMemo(() => {
    return Array.isArray(data.goals) ? data.goals : [];
  }, [data.goals]);
  
  const processedRisks = useMemo(() => {
    return Array.isArray(data.risks) ? data.risks : [];
  }, [data.risks]);
  
  const processedTeamMembers = useMemo(() => {
    return Array.isArray(data.teamMembers) ? data.teamMembers : [];
  }, [data.teamMembers]);
  
  const processedMemberAllocations = useMemo(() => {
    return Array.isArray(data.memberAllocations) ? data.memberAllocations : [];
  }, [data.memberAllocations]);
  
  // Ensure teamAllocations is always an array for UI rendering
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

  // Update data with the ensured arrays
  const safeOptionData = useMemo(() => ({
    ...data,
    goals: processedGoals,
    risks: processedRisks,
    teamMembers: processedTeamMembers,
    memberAllocations: processedMemberAllocations,
    teamAllocations: processedTeamAllocations
  }), [
    data, 
    processedGoals, 
    processedRisks, 
    processedTeamMembers, 
    processedMemberAllocations, 
    processedTeamAllocations
  ]);

  const {
    connectedTeams,
    requestTeamAllocation,
    costs,
    CostSummary
  } = useTeamAllocation(id, safeOptionData);

  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, safeOptionData, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });

  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const durationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });
  
  // Save data to backend
  const saveToBackend = useCallback(async (field: string, value: any) => {
    try {
      await GraphApiClient.updateNode('option' as NodeType, id, { [field]: value });
      console.log(`Updated option node ${id} ${field}`);
    } catch (error) {
      console.error(`Failed to update option node ${id}:`, error);
      toast.error(`Update Failed: Failed to save ${field} to the server.`);
    }
  }, [id]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    updateNodeData(id, { ...safeOptionData, title: newTitle });
    
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend('title', newTitle);
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    updateNodeData(id, { ...safeOptionData, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      await saveToBackend('description', newDescription);
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
    saveToBackend('goals', updatedGoals);
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
    saveToBackend('goals', updatedGoals);
  }, [id, safeOptionData, processedGoals, updateNodeData, saveToBackend]);

  // Remove a goal
  const removeGoal = useCallback((goalId: string) => {
    const updatedGoals = processedGoals.filter(goal => goal.id !== goalId);
    updateNodeData(id, {
      ...safeOptionData,
      goals: updatedGoals
    });
    saveToBackend('goals', updatedGoals);
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
    saveToBackend('risks', updatedRisks);
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
    saveToBackend('risks', updatedRisks);
  }, [id, safeOptionData, processedRisks, updateNodeData, saveToBackend]);

  // Remove a risk
  const removeRisk = useCallback((riskId: string) => {
    const updatedRisks = processedRisks.filter(risk => risk.id !== riskId);
    updateNodeData(id, {
      ...safeOptionData,
      risks: updatedRisks
    });
    saveToBackend('risks', updatedRisks);
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
    updateNodeData(id, { ...safeOptionData, optionType: value });
    saveToBackend('optionType', value);
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle transaction fee change
  const handleTransactionFeeChange = useCallback((value: number) => {
    if (!isNaN(value) && value >= 0 && value <= 100) {
      updateNodeData(id, { ...safeOptionData, transactionFeeRate: value });
      saveToBackend('transactionFeeRate', value);
    }
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle monthly volume change
  const handleMonthlyVolumeChange = useCallback((value: number) => {
    if (!isNaN(value) && value >= 0) {
      updateNodeData(id, { ...safeOptionData, monthlyVolume: value });
      saveToBackend('monthlyVolume', value);
    }
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Duration input hook
  const duration = useDurationInput(id, safeOptionData, updateNodeData, {
    maxDays: 90,
    label: "Time to Close",
    fieldName: "duration",
    tip: 'Estimated time to close the deal and go live'
  });

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

  // Add an effect to ensure teamAllocations is always an array
  useEffect(() => {
    // If teamAllocations is undefined or null, initialize as empty array
    if (data.teamAllocations === undefined || data.teamAllocations === null) {
      console.log('🔄 Initializing teamAllocations as empty array');
      updateNodeData(id, { ...data, teamAllocations: [] });
      return;
    }
    
    // If teamAllocations is not an array, try to convert it
    if (!Array.isArray(data.teamAllocations)) {
      console.log('🔄 Converting teamAllocations to array:', data.teamAllocations);
      
      // If it's a string, try to parse it
      if (typeof data.teamAllocations === 'string') {
        try {
          const parsed = JSON.parse(data.teamAllocations);
          if (Array.isArray(parsed)) {
            console.log('✅ Successfully parsed teamAllocations string to array:', parsed);
            updateNodeData(id, { ...data, teamAllocations: parsed });
          } else {
            console.warn('⚠️ Parsed teamAllocations is not an array, using empty array instead');
            updateNodeData(id, { ...data, teamAllocations: [] });
          }
        } catch (e) {
          console.warn('❌ Failed to parse teamAllocations string, using empty array instead:', e);
          updateNodeData(id, { ...data, teamAllocations: [] });
        }
      } else {
        console.warn('⚠️ teamAllocations is not an array or string, using empty array instead');
        updateNodeData(id, { ...data, teamAllocations: [] });
      }
    }
  }, [id, data, updateNodeData]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (durationDebounceRef.current) clearTimeout(durationDebounceRef.current);
      if (teamAllocationsDebounceRef.current?.timeout) clearTimeout(teamAllocationsDebounceRef.current.timeout);
    };
  }, []);
  
  // Save team allocations to backend with proper debouncing
  const saveTeamAllocationsToBackend = useCallback(async (teamAllocations: TeamAllocation[]) => {
    // Create a debounce ref if it doesn't exist yet
    if (!teamAllocationsDebounceRef.current) {
      teamAllocationsDebounceRef.current = { timeout: null };
    }
    
    // Clear any existing timeout
    if (teamAllocationsDebounceRef.current.timeout) {
      clearTimeout(teamAllocationsDebounceRef.current.timeout);
    }
    
    // Ensure teamAllocations is an array
    if (!Array.isArray(teamAllocations)) {
      console.warn('Cannot save teamAllocations: not an array', teamAllocations);
      return;
    }
    
    // Set a new debounce timer
    teamAllocationsDebounceRef.current.timeout = setTimeout(async () => {
      console.log('💾 Saving teamAllocations to backend:', teamAllocations);
      
      // Update the node data with the array version first
      updateNodeData(id, { ...safeOptionData, teamAllocations });
      
      // Then save to backend
      await saveToBackend('teamAllocations', teamAllocations);
      
      // Clear the timeout reference
      teamAllocationsDebounceRef.current.timeout = null;
    }, 1000); // 1 second debounce
  }, [id, safeOptionData, updateNodeData, saveToBackend]);

  // Handle team member allocation
  const handleTeamMemberAllocation = useCallback((teamId: string, memberId: string, hoursRequested: number) => {
    // Find the team allocation for this team
    const teamAllocation = Array.isArray(processedTeamAllocations) 
      ? processedTeamAllocations.find(ta => ta.teamId === teamId)
      : undefined;
    
    // Create a copy of the team allocations array
    const updatedTeamAllocations = Array.isArray(processedTeamAllocations) 
      ? [...processedTeamAllocations] 
      : [];
    
    if (teamAllocation) {
      // Find the index of the team allocation
      const teamIndex = updatedTeamAllocations.findIndex(ta => ta.teamId === teamId);
      
      // Find the member allocation
      const memberAllocation = teamAllocation.allocatedMembers.find((am: { memberId: string, hours: number }) => am.memberId === memberId);
      
      if (memberAllocation) {
        // Update the existing member allocation
        const updatedMembers = teamAllocation.allocatedMembers.map((am: { memberId: string, hours: number }) => {
          if (am.memberId === memberId) {
            return { ...am, hours: hoursRequested };
          }
          return am;
        });
        
        // Update the team allocation
        updatedTeamAllocations[teamIndex] = {
          ...teamAllocation,
          allocatedMembers: updatedMembers
        };
      } else {
        // Add a new member allocation
        updatedTeamAllocations[teamIndex] = {
          ...teamAllocation,
          allocatedMembers: [
            ...teamAllocation.allocatedMembers,
            { memberId, hours: hoursRequested }
          ]
        };
      }
    } else {
      // Create a new team allocation
      updatedTeamAllocations.push({
        teamId,
        requestedHours: hoursRequested,
        allocatedMembers: [{ memberId, hours: hoursRequested }]
      });
    }
    
    // Update node data
    updateNodeData(id, {
      ...safeOptionData,
      teamAllocations: updatedTeamAllocations
    });
    
    // Save to backend
    saveTeamAllocationsToBackend(updatedTeamAllocations);
    
    // Also update via the hook for UI consistency
    requestTeamAllocation(teamId, hoursRequested, [memberId]);
  }, [
    processedTeamAllocations, 
    safeOptionData, 
    id, 
    updateNodeData, 
    saveTeamAllocationsToBackend, 
    requestTeamAllocation
  ]);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data properties
    title: safeOptionData.title || '',
    description: safeOptionData.description || '',
    optionType: safeOptionData.optionType,
    transactionFeeRate: safeOptionData.transactionFeeRate,
    monthlyVolume: safeOptionData.monthlyVolume,
    status,
    processedGoals,
    processedRisks,
    processedTeamAllocations,
    connectedTeams,
    costs,
    expectedMonthlyValue,
    payoffDetails,
    
    // Actions
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    handleOptionTypeChange,
    handleTransactionFeeChange,
    handleMonthlyVolumeChange,
    cycleStatus,
    getStatusColor,
    addGoal,
    updateGoal,
    removeGoal,
    addRisk,
    updateRisk,
    removeRisk,
    handleTeamMemberAllocation,
    
    // Utilities
    duration,
    CostSummary
  }), [
    safeOptionData.title,
    safeOptionData.description,
    safeOptionData.optionType,
    safeOptionData.transactionFeeRate,
    safeOptionData.monthlyVolume,
    status,
    processedGoals,
    processedRisks,
    processedTeamAllocations,
    connectedTeams,
    costs,
    expectedMonthlyValue,
    payoffDetails,
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    handleOptionTypeChange,
    handleTransactionFeeChange,
    handleMonthlyVolumeChange,
    cycleStatus,
    getStatusColor,
    addGoal,
    updateGoal,
    removeGoal,
    addRisk,
    updateRisk,
    removeRisk,
    handleTeamMemberAllocation,
    duration,
    CostSummary
  ]);
} 