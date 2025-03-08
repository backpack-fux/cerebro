"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { 
  RFOptionNodeData, 
  Goal, 
  Risk, 
  OptionType,
  TeamAllocation,
  ImpactLevel,
  SeverityLevel
} from '@/services/graph/option/option.types';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { toast } from "sonner";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus } from './useNodeStatus';
import { useDurationInput } from './useDurationInput';
import { v4 as uuidv4 } from 'uuid';
import { 
  calculateWeeklyCapacity, 
  percentageToHours,
  MemberCapacity
} from '@/lib/utils';

// Utility function to round numbers to 1 decimal place for better display
const roundToOneDecimal = (num: number): number => {
  return Math.round(num * 10) / 10;
};

// Define a more specific type for member allocations if not already defined in option.types.ts
interface MemberAllocation {
  memberId: string;
  name?: string;
  hours: number;
}

/**
 * Hook for managing option node state and operations
 * Separates domain logic from React Flow component state
 */
export function useOptionNode(id: string, data: RFOptionNodeData) {
  const { updateNodeData, setNodes, setEdges, getEdges, getNodes } = useReactFlow();
  
  // State for option data
  const [title, setTitle] = useState(data.title || '');
  const [description, setDescription] = useState(data.description || '');
  const [optionType, setOptionType] = useState<OptionType | undefined>(data.optionType);
  const [transactionFeeRate, setTransactionFeeRate] = useState<number | undefined>(data.transactionFeeRate);
  const [monthlyVolume, setMonthlyVolume] = useState<number | undefined>(data.monthlyVolume);
  const [goals, setGoals] = useState<Goal[]>(data.goals || []);
  const [risks, setRisks] = useState<Risk[]>(data.risks || []);
  const [teamAllocations, setTeamAllocations] = useState<TeamAllocation[]>(
    Array.isArray(data.teamAllocations) ? data.teamAllocations : []
  );
  
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
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
        return [];
      }
    }
    return [];
  }, [data.teamAllocations]);

  // Create a safe copy of the data for hooks
  const safeOptionData = useMemo(() => ({
    ...data,
    goals: processedGoals,
    risks: processedRisks,
    teamMembers: processedTeamMembers,
    memberAllocations: processedMemberAllocations,
    teamAllocations: processedTeamAllocations
  }), [data, processedGoals, processedRisks, processedTeamMembers, processedMemberAllocations, processedTeamAllocations]);

  // Save team allocations to backend
  const saveTeamAllocationsToBackend = useCallback(async (allocations: TeamAllocation[]) => {
    try {
      // Log the team allocations before sending to backend
      console.log('Team allocations being sent to backend:', JSON.stringify(allocations, null, 2));
      
      await GraphApiClient.updateNode('option' as NodeType, id, {
        teamAllocations: allocations
      });
      console.log('✅ Successfully saved team allocations to backend');
    } catch (error) {
      console.error('❌ Failed to save team allocations to backend:', error);
    }
  }, [id]);

  // Use the team allocation hook to manage team allocations
  const teamAllocationHook = useTeamAllocation(id, data);
  
  // Add the saveTeamAllocationsToBackend function to the teamAllocationHook
  (teamAllocationHook as any).saveTeamAllocationsToBackend = saveTeamAllocationsToBackend;
  
  // Extract the processed team allocations from the hook
  const teamAllocationsFromHook = teamAllocationHook.teamAllocations;
  
  // Get connected teams from the team allocation hook
  const connectedTeams = teamAllocationHook.connectedTeams;
  
  // Get costs from the team allocation hook
  const costs = teamAllocationHook.costs;
  
  // Use the node status hook to manage status
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    data, 
    updateNodeData, 
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );
  
  // Use the duration input hook to manage duration
  const duration = useDurationInput(
    id, 
    data, 
    updateNodeData,
    {
      maxDays: 180,
      label: 'Time to Close',
      fieldName: 'duration',
      tip: 'Use "d" for days or "w" for weeks.',
    }
  );

  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });

  // Save to backend function
  const saveToBackend = useCallback(async (field: string, value: any) => {
    try {
      await GraphApiClient.updateNode('option' as NodeType, id, {
        [field]: value
      });
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

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (teamAllocationsDebounceRef.current?.timeout) clearTimeout(teamAllocationsDebounceRef.current.timeout);
    };
  }, []);

  // Function to refresh data from the server
  const refreshData = useCallback(async () => {
    console.log(`🔄 Manually refreshing option data for ${id}`);
    
    try {
      // Check if this is a known blacklisted node
      if (GraphApiClient.isNodeBlacklisted(id)) {
        console.warn(`🚫 Skipping refresh for blacklisted node ${id}`);
        return;
      }
      
      // Use the GraphApiClient to fetch node data
      const serverData = await GraphApiClient.getNode('option' as NodeType, id);
      
      console.log(`🚀 Server returned refreshed data for ${id}:`, serverData);
      
      // Process team allocations
      let processedTeamAllocations: TeamAllocation[] = [];
      
      if (Array.isArray(serverData.data.teamAllocations)) {
        processedTeamAllocations = serverData.data.teamAllocations;
      } else if (typeof serverData.data.teamAllocations === 'string') {
        try {
          processedTeamAllocations = JSON.parse(serverData.data.teamAllocations);
        } catch (e) {
          console.error('❌ Failed to parse teamAllocations:', e);
          processedTeamAllocations = [];
        }
      }
      
      // Update local state with all server data
      setTitle(serverData.data.title || '');
      setDescription(serverData.data.description || '');
      setOptionType(serverData.data.optionType as OptionType || undefined);
      setTransactionFeeRate(serverData.data.transactionFeeRate || undefined);
      setMonthlyVolume(serverData.data.monthlyVolume || undefined);
      setTeamAllocations(processedTeamAllocations);
      
      // Update goals and risks
      if (Array.isArray(serverData.data.goals)) {
        setGoals(serverData.data.goals);
      }
      
      if (Array.isArray(serverData.data.risks)) {
        setRisks(serverData.data.risks);
      }
      
      // Update node data in ReactFlow
      updateNodeData(id, {
        ...data,
        title: serverData.data.title || data.title,
        description: serverData.data.description || data.description,
        optionType: serverData.data.optionType || data.optionType,
        transactionFeeRate: serverData.data.transactionFeeRate || data.transactionFeeRate,
        monthlyVolume: serverData.data.monthlyVolume || data.monthlyVolume,
        teamAllocations: processedTeamAllocations,
        goals: serverData.data.goals || data.goals,
        risks: serverData.data.risks || data.risks,
        duration: serverData.data.duration || data.duration
      });
      
      console.log('✅ Successfully refreshed option data');
      
    } catch (error) {
      console.error(`❌ Error refreshing node data for ${id}:`, error);
      toast.error(`Failed to refresh option ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, data, updateNodeData]);

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
    
    // Team allocation handlers - these are now provided by the shared resource allocation hook
    // handleAllocationChangeLocal,
    // handleAllocationCommit,
    // handleTeamAllocation,
    // handleTeamMemberAllocation,
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
    
    // Duration
    duration,
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
    // handleAllocationChangeLocal,
    // handleAllocationCommit,
    // handleTeamAllocation,
    // handleTeamMemberAllocation,
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
    duration,
  ]);
} 