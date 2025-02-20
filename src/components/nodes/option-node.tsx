"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useReactFlow } from "@xyflow/react";
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

type Goal = {
  id: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
};

type Risk = {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  mitigation?: string;
};

export type OptionType = 'customer' | 'contract' | 'partner';

export type MemberAllocation = {
  memberId: string;
  timePercentage: number;
};

export type OptionNodeData = Node<{
  title: string;
  description?: string;
  optionType?: OptionType;
  transactionFeeRate?: number;
  monthlyVolume?: number;
  duration?: number;
  teamMembers?: string[];
  memberAllocations?: MemberAllocation[];
  goals: Goal[];
  risks: Risk[];
  buildDuration?: number;
  timeToClose?: number;
  teamAllocations?: Array<{
    teamId: string;
    requestedHours: number;
    allocatedMembers: Array<{
      memberId: string;
      hours: number;
    }>;
  }>;
}>;

export function OptionNode({ id, data, selected }: NodeProps<OptionNodeData>) {
  const { updateNodeData, setNodes } = useReactFlow();
  const {
    connectedTeams,
    requestTeamAllocation,
    costs,
    CostSummary
  } = useTeamAllocation(id, data);

  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, data, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, description: e.target.value });
  }, [id, data, updateNodeData]);

  const addGoal = useCallback(() => {
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      description: '',
      impact: 'medium'
    };
    updateNodeData(id, { 
      ...data, 
      goals: [...(data.goals || []), newGoal] 
    });
  }, [id, data, updateNodeData]);

  const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
    updateNodeData(id, {
      ...data,
      goals: data.goals.map(goal => 
        goal.id === goalId ? { ...goal, ...updates } : goal
      )
    });
  }, [id, data, updateNodeData]);

  const removeGoal = useCallback((goalId: string) => {
    updateNodeData(id, {
      ...data,
      goals: data.goals.filter(goal => goal.id !== goalId)
    });
  }, [id, data, updateNodeData]);

  const addRisk = useCallback(() => {
    const newRisk: Risk = {
      id: `risk-${Date.now()}`,
      description: '',
      severity: 'medium'
    };
    updateNodeData(id, { 
      ...data, 
      risks: [...(data.risks || []), newRisk] 
    });
  }, [id, data, updateNodeData]);

  const updateRisk = useCallback((riskId: string, updates: Partial<Risk>) => {
    updateNodeData(id, {
      ...data,
      risks: data.risks.map(risk => 
        risk.id === riskId ? { ...risk, ...updates } : risk
      )
    });
  }, [id, data, updateNodeData]);

  const removeRisk = useCallback((riskId: string) => {
    updateNodeData(id, {
      ...data,
      risks: data.risks.filter(risk => risk.id !== riskId)
    });
  }, [id, data, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  const handleOptionTypeChange = useCallback((value: OptionType) => {
    updateNodeData(id, { ...data, optionType: value });
  }, [id, data, updateNodeData]);

  const handleTransactionFeeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      updateNodeData(id, { ...data, transactionFeeRate: value });
    }
  }, [id, data, updateNodeData]);

  const handleMonthlyVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      updateNodeData(id, { ...data, monthlyVolume: value });
    }
  }, [id, data, updateNodeData]);

  const duration = useDurationInput(id, data, updateNodeData, {
    maxDays: 90,
    label: "Time to Close",
    fieldName: "duration",
    tip: 'Estimated time to close the deal and go live'
  });

  // Calculate expected monthly value
  const expectedMonthlyValue = useMemo(() => {
    if (data.transactionFeeRate && data.monthlyVolume) {
      return (data.transactionFeeRate / 100) * data.monthlyVolume;
    }
    return 0;
  }, [data.transactionFeeRate, data.monthlyVolume]);

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

    // Update the allocation
    const hoursRequested = (percentage / 100) * 8 * (data.duration || 1); // Convert % to hours
    requestTeamAllocation(teamId, hoursRequested, [memberId]);
  }, [connectedTeams, data.duration, requestTeamAllocation]);

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
              value={data.title}
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
            value={data.optionType}
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

        {data.optionType === 'customer' && (
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Transaction Fee Rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={data.transactionFeeRate || ''}
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
                  value={data.monthlyVolume || ''}
                  onChange={handleMonthlyVolumeChange}
                  className="pl-7 bg-transparent"
                  placeholder="0.00"
                  min={0}
                  step={1000}
                />
              </div>
            </div>

            {(data.transactionFeeRate || data.monthlyVolume) && (
              <div className="space-y-1 pt-2 border-t">
                {data.transactionFeeRate && data.transactionFeeRate > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Fee Rate:</span>
                    <span>${data.transactionFeeRate.toFixed(2)} per $100</span>
                  </div>
                )}
                {data.monthlyVolume && data.monthlyVolume > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Monthly Volume:</span>
                    <span>
                      ${data.monthlyVolume.toLocaleString('en-US', { 
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
                      const allocation = data.teamAllocations
                        ?.find(a => a.teamId === team.teamId)
                        ?.allocatedMembers
                        .find(m => m.memberId === member.memberId);
                      
                      const percentage = allocation 
                        ? (allocation.hours / 8 / (data.duration || 1)) * 100 
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
          <CostSummary costs={costs} duration={data.duration} />
        )}

        <Textarea
          value={data.description || ''}
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
            {data.goals?.map(goal => (
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
            {data.risks?.map(risk => (
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
