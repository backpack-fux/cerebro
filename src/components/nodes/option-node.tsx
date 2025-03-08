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
import { memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  RFOptionNodeData, 
  Goal, 
  Risk, 
  OptionType
} from '@/services/graph/option/option.types';
import { useOptionNode } from '@/hooks/useOptionNode';

// Use React.memo to prevent unnecessary re-renders
const OptionNode = memo(function OptionNode({ id, data, selected }: NodeProps) {
  // Use our custom hook for option node logic
  const option = useOptionNode(id, data as RFOptionNodeData);
  
  return (
    <BaseNode selected={selected}>
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
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Option Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Option node menu">
            <DropdownMenuItem onSelect={option.handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <div className="space-y-2">
          <Label>Option Type</Label>
          <RadioGroup
            value={option.optionType}
            onValueChange={option.handleOptionTypeChange}
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

        {option.optionType === 'customer' && (
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Transaction Fee Rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={option.transactionFeeRate || ''}
                  onChange={(e) => option.handleTransactionFeeChange(parseFloat(e.target.value))}
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
                  value={option.monthlyVolume || ''}
                  onChange={(e) => option.handleMonthlyVolumeChange(parseFloat(e.target.value))}
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
                      ${option.monthlyVolume.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                )}
                {option.expectedMonthlyValue > 0 && (
                  <div className="text-sm font-medium flex justify-between items-center pt-1">
                    <span>Expected Monthly Revenue:</span>
                    <Badge variant="default">
                      ${option.expectedMonthlyValue.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
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

        {/* Time to Close Section */}
        <div className="space-y-2">
          <Label>{option.duration.config.label}</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={option.duration.value || ''}
                onChange={(e) => option.duration.handleDurationChange(e.target.value)}
                onKeyDown={option.duration.handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {option.duration.displayValue}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {option.duration.config.tip} Max {option.duration.formatDuration(option.duration.config.maxDays)}
            </p>
          </div>
        </div>

        {/* Team Allocations Section */}
        <div className="space-y-2">
          <Label>Team Allocations</Label>
          
          {option.connectedTeams.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          ) : (
            <div className="space-y-4">
              {option.connectedTeams.map(team => (
                <div key={team.teamId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team.name}</span>
                  </div>

                  {/* Member Allocation Controls */}
                  <div className="space-y-4">
                    {team.availableBandwidth.map(member => {
                      const allocation = option.processedTeamAllocations
                        .find(a => a.teamId === team.teamId)
                        ?.allocatedMembers
                        .find((m: { memberId: string }) => m.memberId === member.memberId);
                      
                      const percentage = allocation 
                        ? (allocation.hours / 8 / ((data as RFOptionNodeData).duration || 1)) * 100 
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
                            onValueChange={([value]) => {
                              const hoursRequested = (value / 100) * 8 * ((data as RFOptionNodeData).duration || 1);
                              option.handleTeamMemberAllocation(team.teamId, member.memberId, hoursRequested);
                            }}
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
        {option.costs && option.costs.allocations.length > 0 && (
          <option.CostSummary costs={option.costs} duration={(data as RFOptionNodeData).duration} />
        )}

        <Textarea
          value={option.description}
          onChange={(e) => option.handleDescriptionChange(e.target.value)}
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
              onClick={option.addGoal}
              className="h-6 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {option.processedGoals.map(goal => (
              <div key={goal.id} className="flex gap-2 items-start">
                <Textarea
                  value={goal.description}
                  onChange={(e) => option.updateGoal(goal.id, { description: e.target.value })}
                  placeholder="Describe the goal..."
                  className="flex-1 min-h-[60px] text-sm"
                />
                <div className="flex flex-col gap-1">
                  <Badge 
                    variant={goal.impact === 'high' ? 'default' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => option.updateGoal(goal.id, { 
                      impact: goal.impact === 'high' ? 'medium' : 'high' 
                    })}
                  >
                    {goal.impact}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => option.removeGoal(goal.id)}
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
              onClick={option.addRisk}
              className="h-6 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {option.processedRisks.map(risk => (
              <div key={risk.id} className="space-y-2">
                <div className="flex gap-2 items-start">
                  <Textarea
                    value={risk.description}
                    onChange={(e) => option.updateRisk(risk.id, { description: e.target.value })}
                    placeholder="Describe the risk..."
                    className="flex-1 min-h-[60px] text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <Badge 
                      variant={risk.severity === 'high' ? 'destructive' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => option.updateRisk(risk.id, { 
                        severity: risk.severity === 'high' ? 'medium' : 'high' 
                      })}
                    >
                      {risk.severity}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => option.removeRisk(risk.id)}
                      className="h-6 px-2"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={risk.mitigation}
                  onChange={(e) => option.updateRisk(risk.id, { mitigation: e.target.value })}
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
});

// Export the memoized component
export { OptionNode };
