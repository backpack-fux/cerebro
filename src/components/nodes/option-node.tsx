"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { memo, useMemo, useState, useEffect } from "react";
import { useEdges, useReactFlow } from "@xyflow/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { RFOptionNodeData, ImpactLevel, SeverityLevel } from '@/services/graph/option/option.types';
import { useOptionNode } from '@/hooks/useOptionNode';
import { useResourceAllocation } from '@/hooks/useResourceAllocation';
import { CostReceipt } from '@/components/shared/CostReceipt';
import { TeamAllocation } from '@/components/shared/TeamAllocation';

/**
 * Format a number with appropriate precision
 */
const formatNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

/**
 * Format hours for display
 */
const formatHours = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${Math.round(hours * 10) / 10} hrs`;
};

/**
 * Option Node component for displaying and editing option data
 * Uses React.memo to prevent unnecessary re-renders
 */
export const OptionNode = memo(function OptionNode({ id, data, selected }: NodeProps) {
  const edges = useEdges();
  const { getNodes } = useReactFlow();
  
  // Use our custom hook for option node logic
  const option = useOptionNode(id, data as RFOptionNodeData);
  
  // Use the shared resource allocation hook
  const resourceAllocation = useResourceAllocation(data, option, getNodes);
  
  // Local state for input values to prevent clearing during re-renders
  const [localTransactionFee, setLocalTransactionFee] = useState<string>(
    option.transactionFeeRate !== undefined ? option.transactionFeeRate.toString() : ''
  );
  const [localMonthlyVolume, setLocalMonthlyVolume] = useState<string>(
    option.monthlyVolume !== undefined ? option.monthlyVolume.toString() : ''
  );
  
  // Update local state when option values change
  useEffect(() => {
    if (option.transactionFeeRate !== undefined) {
      setLocalTransactionFee(option.transactionFeeRate.toString());
    }
    if (option.monthlyVolume !== undefined) {
      setLocalMonthlyVolume(option.monthlyVolume.toString());
    }
  }, [option.transactionFeeRate, option.monthlyVolume]);
  
  // Handle transaction fee input change
  const handleTransactionFeeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalTransactionFee(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      option.handleTransactionFeeChange(numValue);
    }
  };
  
  // Handle monthly volume input change
  const handleMonthlyVolumeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalMonthlyVolume(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      option.handleMonthlyVolumeChange(numValue);
    }
  };
  
  /**
   * Format a member name from various data sources
   * @param memberId The member ID
   * @param memberData Optional member data object
   * @returns Formatted member name
   */
  const formatMemberName = (memberId: string, memberData?: any): string => {
    // Try to get the name from the member data first
    if (memberData?.name) return memberData.name;
    
    // Otherwise, try to find the node in the graph
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    
    // If we found the node, use its title
    if (memberNode?.data?.title) {
      return String(memberNode.data.title);
    }
    
    // Last resort: use the first part of the ID
    return memberId.split('-')[0];
  };
  
  // Calculate project duration in days for allocation calculations
  const projectDurationDays = Number(data.duration) || 1;
  
  // Pre-calculate allocation percentages and costs for all members
  const memberAllocations = useMemo(() => {
    return resourceAllocation.calculateMemberAllocations(
      option.connectedTeams,
      option.processedTeamAllocations,
      projectDurationDays,
      formatMemberName
    );
  }, [
    option.connectedTeams, 
    option.processedTeamAllocations, 
    projectDurationDays, 
    formatMemberName,
    resourceAllocation.calculateMemberAllocations
  ]);
  
  // Calculate cost summary
  const costSummary = useMemo(() => {
    return resourceAllocation.calculateCostSummary(memberAllocations);
  }, [memberAllocations, resourceAllocation.calculateCostSummary]);
  
  return (
    <BaseNode selected={selected} className="w-[400px]">
      <Handle type="source" position={Position.Top} id="source" />
      <Handle type="target" position={Position.Bottom} id="target" />
      
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${option.getStatusColor(option.status)}`}
              onClick={option.cycleStatus}
            >
              {option.status}
            </Badge>
            <input
              value={option.title}
              onChange={(e) => option.handleTitleChange(e.target.value)}
              className="bg-transparent outline-none w-full"
              placeholder="Option Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <button
            onClick={option.refreshData}
            className="p-1 rounded-md hover:bg-muted"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NodeHeaderMenuAction label="Option Actions">
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={option.handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <Label>Option Type</Label>
          <RadioGroup
            value={option.optionType || 'customer'}
            onValueChange={option.handleOptionTypeChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="customer" id="customer" />
              <Label htmlFor="customer">Customer</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="contract" id="contract" />
              <Label htmlFor="contract">Contract</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partner" id="partner" />
              <Label htmlFor="partner">Partner</Label>
            </div>
          </RadioGroup>
        </div>

        {(option.optionType === 'customer' || option.optionType === undefined) && (
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Transaction Fee Rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={localTransactionFee}
                  onChange={handleTransactionFeeInput}
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
                  value={localMonthlyVolume}
                  onChange={handleMonthlyVolumeInput}
                  className="pl-7 bg-transparent"
                  placeholder="0.00"
                  min={0}
                  step={1000}
                />
              </div>
            </div>

            {(option.transactionFeeRate || option.monthlyVolume) && (
              <div className="space-y-1 pt-2 border-t">
                {option.transactionFeeRate && option.transactionFeeRate > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Fee Rate:</span>
                    <span>${option.transactionFeeRate.toFixed(2)} per $100</span>
                  </div>
                )}
                {option.monthlyVolume && option.monthlyVolume > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Monthly Volume:</span>
                    <span>
                      ${formatNumber(option.monthlyVolume)}
                    </span>
                  </div>
                )}
                {option.expectedMonthlyValue > 0 && (
                  <div className="text-sm font-medium flex justify-between items-center pt-1">
                    <span>Expected Monthly Revenue:</span>
                    <Badge variant="default">
                      ${formatNumber(option.expectedMonthlyValue)}
                    </Badge>
                  </div>
                )}
                {option.payoffDetails && option.payoffDetails.isPayoffPossible && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Time to Payoff:</span>
                    <span>
                      {option.payoffDetails.monthsToPayoff < 1 
                        ? `${Math.round(option.payoffDetails.monthsToPayoff * 30)} days`
                        : option.payoffDetails.monthsToPayoff < 12
                          ? `${option.payoffDetails.monthsToPayoff.toFixed(1)} months`
                          : `${option.payoffDetails.yearsToPayoff.toFixed(1)} years`
                      }
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Time to Close */}
        <div className="space-y-1">
          <Label>{option.timeToClose.config.label}</Label>
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium">
              {option.timeToClose.displayValue}
            </div>
            <Input
              value={option.timeToClose.value || ''}
              onChange={(e) => option.timeToClose.handleDurationChange(e.target.value)}
              onKeyDown={option.timeToClose.handleDurationKeyDown}
              className="w-20 h-8"
              placeholder="Days"
            />
          </div>
        </div>

        <Textarea
          value={option.description}
          onChange={(e) => option.handleDescriptionChange(e.target.value)}
          placeholder="Describe this option..."
          className="min-h-[80px] resize-none"
        />

        {/* Resource Allocation Section */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>Resource Allocation</span>
            <Badge variant="outline" className="font-mono">
              {formatHours(costSummary.totalHours)}
            </Badge>
          </Label>
          
          {option.connectedTeams.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          )}
          
          {option.connectedTeams.map(team => (
            <TeamAllocation
              key={team.teamId}
              team={team}
              teamAllocation={option.processedTeamAllocations.find(a => a.teamId === team.teamId)}
              memberAllocations={memberAllocations}
              projectDurationDays={projectDurationDays}
              formatMemberName={formatMemberName}
              onMemberValueChange={resourceAllocation.handleAllocationChangeLocal}
              onMemberValueCommit={resourceAllocation.handleAllocationCommit}
            />
          ))}
        </div>

        {/* Cost Receipt Section */}
        {costSummary.allocations.length > 0 && (
          <CostReceipt 
            allocations={costSummary.allocations}
            totalCost={costSummary.totalCost}
            totalHours={costSummary.totalHours}
            totalDays={costSummary.totalDays}
          />
        )}

        {/* Goals & Value Creation Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Goals & Value Creation</Label>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5" 
              onClick={option.addGoal}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          {option.processedGoals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Add goals to track value creation
            </div>
          ) : (
            <div className="space-y-2">
              {option.processedGoals.map(goal => (
                <div key={goal.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                  <Textarea
                    value={goal.description || ''}
                    onChange={(e) => option.updateGoal(goal.id, { description: e.target.value })}
                    placeholder="Describe this goal..."
                    className="flex-1 min-h-[60px] resize-none bg-transparent text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <RadioGroup
                      value={goal.impact || 'medium'}
                      onValueChange={(value: ImpactLevel) => option.updateGoal(goal.id, { impact: value })}
                      className="flex flex-col gap-1"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="high" id={`${goal.id}-high`} className="h-3 w-3" />
                        <Label htmlFor={`${goal.id}-high`} className="text-xs">High</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="medium" id={`${goal.id}-medium`} className="h-3 w-3" />
                        <Label htmlFor={`${goal.id}-medium`} className="text-xs">Med</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="low" id={`${goal.id}-low`} className="h-3 w-3" />
                        <Label htmlFor={`${goal.id}-low`} className="text-xs">Low</Label>
                      </div>
                    </RadioGroup>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 mt-1" 
                      onClick={() => option.removeGoal(goal.id)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risks & Mitigations Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Risks & Mitigations</Label>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5" 
              onClick={option.addRisk}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          {option.processedRisks.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Add risks to track potential issues
            </div>
          ) : (
            <div className="space-y-2">
              {option.processedRisks.map(risk => (
                <div key={risk.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                  <Textarea
                    value={risk.description || ''}
                    onChange={(e) => option.updateRisk(risk.id, { description: e.target.value })}
                    placeholder="Describe this risk..."
                    className="flex-1 min-h-[60px] resize-none bg-transparent text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <RadioGroup
                      value={risk.severity || 'medium'}
                      onValueChange={(value: SeverityLevel) => option.updateRisk(risk.id, { severity: value })}
                      className="flex flex-col gap-1"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="high" id={`${risk.id}-high`} className="h-3 w-3" />
                        <Label htmlFor={`${risk.id}-high`} className="text-xs">High</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="medium" id={`${risk.id}-medium`} className="h-3 w-3" />
                        <Label htmlFor={`${risk.id}-medium`} className="text-xs">Med</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="low" id={`${risk.id}-low`} className="h-3 w-3" />
                        <Label htmlFor={`${risk.id}-low`} className="text-xs">Low</Label>
                      </div>
                    </RadioGroup>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 mt-1" 
                      onClick={() => option.removeRisk(risk.id)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});

// Export the memoized component
export default OptionNode;
