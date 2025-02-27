"use client";

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { Slider } from "@/components/ui/slider";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useNodeStatus } from "@/hooks/useNodeStatus";
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

export function OptionNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, setNodes, setEdges, getEdges } = useReactFlow();
  
  // Cast data to the correct type
  const optionData = data as RFOptionNodeData;
  
  // Ensure complex objects are always arrays
  const goals = Array.isArray(optionData.goals) ? optionData.goals : [];
  const risks = Array.isArray(optionData.risks) ? optionData.risks : [];
  const teamMembers = Array.isArray(optionData.teamMembers) ? optionData.teamMembers : [];
  const memberAllocations = Array.isArray(optionData.memberAllocations) ? optionData.memberAllocations : [];
  const teamAllocations = Array.isArray(optionData.teamAllocations) ? optionData.teamAllocations : [];
  
  // Update optionData with the ensured arrays
  const safeOptionData = {
    ...optionData,
    goals,
    risks,
    teamMembers,
    memberAllocations,
    teamAllocations
  };
  
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

  // Save data to backend
  const saveToBackend = async (field: string, value: any) => {
    try {
      await GraphApiClient.updateNode('option' as NodeType, id, { [field]: value });
      console.log(`Updated option node ${id} ${field}`);
    } catch (error) {
      console.error(`Failed to update option node ${id}:`, error);
      toast.error(`Update Failed: Failed to save ${field} to the server.`);
    }
  };

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    updateNodeData(id, { ...safeOptionData, title: newTitle });
    saveToBackend('title', newTitle);
  }, [id, safeOptionData, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    updateNodeData(id, { ...safeOptionData, description: newDescription });
    saveToBackend('description', newDescription);
  }, [id, safeOptionData, updateNodeData]);

  const addGoal = useCallback(() => {
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      description: '',
      impact: 'medium'
    };
    const updatedGoals = [...goals, newGoal];
    updateNodeData(id, { 
      ...safeOptionData, 
      goals: updatedGoals
    });
    saveToBackend('goals', updatedGoals);
  }, [id, safeOptionData, goals, updateNodeData]);

  const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
    const updatedGoals = goals.map(goal => 
      goal.id === goalId ? { ...goal, ...updates } : goal
    );
    updateNodeData(id, {
      ...safeOptionData,
      goals: updatedGoals
    });
    saveToBackend('goals', updatedGoals);
  }, [id, safeOptionData, goals, updateNodeData]);

  const removeGoal = useCallback((goalId: string) => {
    const updatedGoals = goals.filter(goal => goal.id !== goalId);
    updateNodeData(id, {
      ...safeOptionData,
      goals: updatedGoals
    });
    saveToBackend('goals', updatedGoals);
  }, [id, safeOptionData, goals, updateNodeData]);

  const addRisk = useCallback(() => {
    const newRisk: Risk = {
      id: `risk-${Date.now()}`,
      description: '',
      severity: 'medium'
    };
    const updatedRisks = [...risks, newRisk];
    updateNodeData(id, { 
      ...safeOptionData, 
      risks: updatedRisks
    });
    saveToBackend('risks', updatedRisks);
  }, [id, safeOptionData, risks, updateNodeData]);

  const updateRisk = useCallback((riskId: string, updates: Partial<Risk>) => {
    const updatedRisks = risks.map(risk => 
      risk.id === riskId ? { ...risk, ...updates } : risk
    );
    updateNodeData(id, {
      ...safeOptionData,
      risks: updatedRisks
    });
    saveToBackend('risks', updatedRisks);
  }, [id, safeOptionData, risks, updateNodeData]);

  const removeRisk = useCallback((riskId: string) => {
    const updatedRisks = risks.filter(risk => risk.id !== riskId);
    updateNodeData(id, {
      ...safeOptionData,
      risks: updatedRisks
    });
    saveToBackend('risks', updatedRisks);
  }, [id, safeOptionData, risks, updateNodeData]);

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

  const handleOptionTypeChange = useCallback((value: OptionType) => {
    updateNodeData(id, { ...safeOptionData, optionType: value });
    saveToBackend('optionType', value);
  }, [id, safeOptionData, updateNodeData]);

  const handleTransactionFeeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      updateNodeData(id, { ...safeOptionData, transactionFeeRate: value });
      saveToBackend('transactionFeeRate', value);
    }
  }, [id, safeOptionData, updateNodeData]);

  const handleMonthlyVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      updateNodeData(id, { ...safeOptionData, monthlyVolume: value });
      saveToBackend('monthlyVolume', value);
    }
  }, [id, safeOptionData, updateNodeData]);

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

  // Add this calculation after the expectedMonthlyValue memo
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

  // Handle allocation changes
  const handleAllocationChange = useCallback((memberId: string, percentage: number) => {
    const teamId = connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    )?.teamId;

    if (!teamId) return;

    // Calculate hours based on percentage
    const hoursRequested = (percentage / 100) * 8 * (safeOptionData.duration || 1); // Convert % to hours
    
    // Update the team allocations in the node data
    let updatedTeamAllocations = [...teamAllocations];
    
    // Find if this team already has an allocation
    const existingTeamIndex = updatedTeamAllocations.findIndex(a => a.teamId === teamId);
    
    if (existingTeamIndex >= 0) {
      // Update existing team allocation
      const existingTeam = updatedTeamAllocations[existingTeamIndex];
      const existingMemberIndex = existingTeam.allocatedMembers.findIndex(m => m.memberId === memberId);
      
      if (existingMemberIndex >= 0) {
        // Update existing member allocation
        updatedTeamAllocations[existingTeamIndex].allocatedMembers[existingMemberIndex].hours = hoursRequested;
      } else {
        // Add new member to existing team
        updatedTeamAllocations[existingTeamIndex].allocatedMembers.push({
          memberId,
          hours: hoursRequested
        });
      }
      
      // Update requested hours total
      updatedTeamAllocations[existingTeamIndex].requestedHours = 
        updatedTeamAllocations[existingTeamIndex].allocatedMembers.reduce(
          (sum, member) => sum + member.hours, 0
        );
    } else {
      // Create new team allocation
      updatedTeamAllocations.push({
        teamId,
        requestedHours: hoursRequested,
        allocatedMembers: [{
          memberId,
          hours: hoursRequested
        }]
      });
    }
    
    // Update node data
    updateNodeData(id, {
      ...safeOptionData,
      teamAllocations: updatedTeamAllocations
    });
    
    // Save to backend
    saveToBackend('teamAllocations', updatedTeamAllocations);
    
    // Also update via the hook for UI consistency
    requestTeamAllocation(teamId, hoursRequested, [memberId]);
  }, [connectedTeams, safeOptionData, id, updateNodeData, requestTeamAllocation]);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${getStatusColor(status)}`}
              onClick={cycleStatus}
            >
              {status}
            </Badge>
            <input
              value={safeOptionData.title}
              onChange={handleTitleChange}
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Option Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Option node menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <div className="space-y-2">
          <Label>Option Type</Label>
          <RadioGroup
            value={safeOptionData.optionType}
            onValueChange={handleOptionTypeChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="customer" id="customer" />
              <Label 
                htmlFor="customer" 
                className="text-sm cursor-pointer"
              >
                Customer
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="contract" id="contract" />
              <Label 
                htmlFor="contract" 
                className="text-sm cursor-pointer"
              >
                Contract
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partner" id="partner" />
              <Label 
                htmlFor="partner" 
                className="text-sm cursor-pointer"
              >
                Partner
              </Label>
            </div>
          </RadioGroup>
        </div>

        {safeOptionData.optionType === 'customer' && (
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Transaction Fee Rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={safeOptionData.transactionFeeRate || ''}
                  onChange={handleTransactionFeeChange}
                  className="pr-8 bg-transparent"
                  placeholder="0.00"
                  min={0}
                  max={100}
                  step={0.01}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expected Monthly Volume</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={safeOptionData.monthlyVolume || ''}
                  onChange={handleMonthlyVolumeChange}
                  className="pl-7 bg-transparent"
                  placeholder="0.00"
                  min={0}
                  step={1000}
                />
              </div>
            </div>

            {(safeOptionData.transactionFeeRate || safeOptionData.monthlyVolume) && (
              <div className="space-y-1 pt-2 border-t">
                {safeOptionData.transactionFeeRate && safeOptionData.transactionFeeRate > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Fee Rate:</span>
                    <span>${safeOptionData.transactionFeeRate.toFixed(2)} per $100</span>
                  </div>
                )}
                {safeOptionData.monthlyVolume && safeOptionData.monthlyVolume > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Monthly Volume:</span>
                    <span>
                      ${safeOptionData.monthlyVolume.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                )}
                {expectedMonthlyValue > 0 && (
                  <div className="text-sm font-medium flex justify-between items-center pt-1">
                    <span>Expected Monthly Revenue:</span>
                    <Badge variant="default">
                      ${expectedMonthlyValue.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </Badge>
                  </div>
                )}
                {payoffDetails && payoffDetails.isPayoffPossible && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Time to Payoff:</span>
                    <span>
                      {payoffDetails.monthsToPayoff < 1 
                        ? `${Math.round(payoffDetails.monthsToPayoff * 30)} days`
                        : payoffDetails.monthsToPayoff < 12
                          ? `${payoffDetails.monthsToPayoff.toFixed(1)} months`
                          : `${payoffDetails.yearsToPayoff.toFixed(1)} years`
                      }
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Time to Close Section */}
        <div className="space-y-2">
          <Label>{duration.config.label}</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={duration.value || ''}
                onChange={(e) => duration.handleDurationChange(e.target.value)}
                onKeyDown={duration.handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {duration.displayValue}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {duration.config.tip} Max {duration.formatDuration(duration.config.maxDays)}
            </p>
          </div>
        </div>

        {/* Team Allocations Section */}
        <div className="space-y-2">
          <Label>Team Allocations</Label>
          
          {connectedTeams.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          ) : (
            <div className="space-y-4">
              {connectedTeams.map(team => (
                <div key={team.teamId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team.title}</span>
                  </div>

                  {/* Member Allocation Controls */}
                  <div className="space-y-4">
                    {team.availableBandwidth.map(member => {
                      const allocation = safeOptionData.teamAllocations
                        ?.find(a => a.teamId === team.teamId)
                        ?.allocatedMembers
                        .find(m => m.memberId === member.memberId);
                      
                      const percentage = allocation 
                        ? (allocation.hours / 8 / (safeOptionData.duration || 1)) * 100 
                        : 0;

                      return (
                        <div key={member.memberId} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{member.name}</span>
                            <span className="text-muted-foreground">
                              {percentage.toFixed(0)}% ({member.availableHours}h available)
                            </span>
                          </div>
                          <Slider
                            value={[percentage]}
                            onValueChange={([value]) => handleAllocationChange(member.memberId, value)}
                            max={100}
                            step={1}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Summary */}
        {costs && costs.allocations.length > 0 && (
          <CostSummary costs={costs} duration={safeOptionData.duration} />
        )}

        <Textarea
          value={safeOptionData.description || ''}
          onChange={handleDescriptionChange}
          placeholder="Describe this option..."
          className="min-h-[80px] resize-y bg-transparent"
        />

        {/* Goals Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Goals & Value Creation</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={addGoal}
              className="h-6 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {goals.map(goal => (
              <div key={goal.id} className="flex gap-2 items-start">
                <Textarea
                  value={goal.description}
                  onChange={(e) => updateGoal(goal.id, { description: e.target.value })}
                  placeholder="Describe the goal..."
                  className="flex-1 min-h-[60px] text-sm"
                />
                <div className="flex flex-col gap-1">
                  <Badge 
                    variant={goal.impact === 'high' ? 'default' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => updateGoal(goal.id, { 
                      impact: goal.impact === 'high' ? 'medium' : 'high' 
                    })}
                  >
                    {goal.impact}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGoal(goal.id)}
                    className="h-6 px-2"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risks Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Risks & Mitigations</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={addRisk}
              className="h-6 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {risks.map(risk => (
              <div key={risk.id} className="space-y-2">
                <div className="flex gap-2 items-start">
                  <Textarea
                    value={risk.description}
                    onChange={(e) => updateRisk(risk.id, { description: e.target.value })}
                    placeholder="Describe the risk..."
                    className="flex-1 min-h-[60px] text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <Badge 
                      variant={risk.severity === 'high' ? 'destructive' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => updateRisk(risk.id, { 
                        severity: risk.severity === 'high' ? 'medium' : 'high' 
                      })}
                    >
                      {risk.severity}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRisk(risk.id)}
                      className="h-6 px-2"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={risk.mitigation}
                  onChange={(e) => updateRisk(risk.id, { mitigation: e.target.value })}
                  placeholder="How will this risk be mitigated?"
                  className="w-full text-sm text-muted-foreground"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Top}
        id="source"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target"
      />
    </BaseNode>
  );
}
