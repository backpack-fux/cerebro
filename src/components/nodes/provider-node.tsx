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
import { useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useDurationInput } from "@/hooks/useDurationInput";
import { Slider } from "@/components/ui/slider";
import { useNodeStatus } from "@/hooks/useNodeStatus";

export type CostType = 'fixed' | 'unit' | 'revenue' | 'tiered';

export type FixedCost = {
  type: 'fixed';
  amount: number;
  frequency: 'monthly' | 'annual';
};

export type UnitCost = {
  type: 'unit';
  unitPrice: number;
  unitType: string;
  minimumUnits?: number;
  maximumUnits?: number;
};

export type RevenueCost = {
  type: 'revenue';
  percentage: number;
  minimumMonthly?: number;
};

export type TierRange = {
  min: number;
  max?: number;
  unitPrice: number;
};

export type TieredCost = {
  type: 'tiered';
  unitType: string;
  tiers: TierRange[];
  minimumMonthly?: number;
};

export type ProviderCost = {
  id: string;
  name: string;
  costType: CostType;
  details: FixedCost | UnitCost | RevenueCost | TieredCost;
};

export type DDStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type DDItem = {
  id: string;
  name: string;
  status: DDStatus;
  notes?: string;
  dueDate?: string;
  assignee?: string; // Could be team member ID
};

export type ProviderNodeData = Node<{
  title: string;
  description?: string;
  duration?: number;
  costs?: ProviderCost[];
  ddItems?: DDItem[];
  teamAllocations?: Array<{
    teamId: string;
    requestedHours: number;
    allocatedMembers: Array<{
      memberId: string;
      hours: number;
    }>;
  }>;
}>;

export function ProviderNode({ id, data, selected }: NodeProps<ProviderNodeData>) {
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

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  const duration = useDurationInput(id, data, updateNodeData, {
    maxDays: 90,
    label: "Integration Duration",
    fieldName: "duration",
    tip: 'Estimated time to integrate with this provider'
  });

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

  const addCost = useCallback(() => {
    const newCost: ProviderCost = {
      id: `cost-${Date.now()}`,
      name: '',
      costType: 'fixed',
      details: {
        type: 'fixed',
        amount: 0,
        frequency: 'monthly'
      }
    };
    updateNodeData(id, { 
      ...data, 
      costs: [...(data.costs || []), newCost] 
    });
  }, [id, data, updateNodeData]);

  const updateCost = useCallback((costId: string, updates: Partial<ProviderCost>) => {
    updateNodeData(id, {
      ...data,
      costs: (data.costs || []).map(cost => 
        cost.id === costId ? { ...cost, ...updates } : cost
      )
    });
  }, [id, data, updateNodeData]);

  const removeCost = useCallback((costId: string) => {
    updateNodeData(id, {
      ...data,
      costs: (data.costs || []).filter(cost => cost.id !== costId)
    });
  }, [id, data, updateNodeData]);

  const addDDItem = useCallback(() => {
    const newItem: DDItem = {
      id: `dd-${Date.now()}`,
      name: '',
      status: 'pending'
    };
    updateNodeData(id, {
      ...data,
      ddItems: [...(data.ddItems || []), newItem]
    });
  }, [id, data, updateNodeData]);

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
              placeholder="Provider Name"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Provider node menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        {/* Duration Input */}
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

        {/* Cost Structures Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Cost Structures</Label>
            <Button variant="ghost" size="sm" onClick={addCost} className="h-6 px-2">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {(data.costs || []).map(cost => (
              <CostStructure
                key={cost.id}
                cost={cost}
                onUpdate={(updates) => updateCost(cost.id, updates)}
                onRemove={() => removeCost(cost.id)}
              />
            ))}
          </div>
        </div>

        {/* Due Diligence Section */}
        <DueDiligenceSection
          items={data.ddItems || []}
          onUpdate={(item) => {
            updateNodeData(id, {
              ...data,
              ddItems: data.ddItems?.map(i => i.id === item.id ? item : i)
            });
          }}
          onAdd={addDDItem}
          onRemove={(itemId) => {
            updateNodeData(id, {
              ...data,
              ddItems: data.ddItems?.filter(i => i.id !== itemId)
            });
          }}
        />

        {/* Cost Summary */}
        {costs && costs.allocations.length > 0 && (
          <CostSummary costs={costs} duration={data.duration} />
        )}

        <Textarea
          value={data.description || ''}
          onChange={handleDescriptionChange}
          placeholder="Describe this provider..."
          className="min-h-[80px] resize-y bg-transparent"
        />
      </div>

      <Handle type="target" position={Position.Bottom} id="target" />
      <Handle type="source" position={Position.Top} id="source" />
    </BaseNode>
  );
}

function CostStructure({ 
  cost, 
  onUpdate, 
  onRemove 
}: { 
  cost: ProviderCost;
  onUpdate: (updates: Partial<ProviderCost>) => void;
  onRemove: () => void;
}) {
  const handleTypeChange = (type: CostType) => {
    console.log('Changing cost type to:', type);
    const newDetails = {
      fixed: { type: 'fixed', amount: 0, frequency: 'monthly' },
      unit: { type: 'unit', unitPrice: 0, unitType: '' },
      revenue: { type: 'revenue', percentage: 0 },
      tiered: { type: 'tiered', unitType: '', tiers: [{ min: 0, unitPrice: 0 }] }
    }[type] as ProviderCost['details'];

    console.log('New cost details:', newDetails);
    onUpdate({ costType: type, details: newDetails });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <Input
            value={cost.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Cost name"
            className="bg-transparent"
          />
          <Select
            value={cost.costType}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger className="w-[180px] bg-transparent">
              <SelectValue placeholder="Select cost type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Cost</SelectItem>
              <SelectItem value="unit">Per Unit</SelectItem>
              <SelectItem value="revenue">Revenue Share</SelectItem>
              <SelectItem value="tiered">Tiered Pricing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 px-2"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      {/* Render different forms based on cost type */}
      {cost.costType === 'fixed' && (
        <FixedCostForm
          details={cost.details as FixedCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
      {cost.costType === 'unit' && (
        <UnitCostForm
          details={cost.details as UnitCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
      {cost.costType === 'revenue' && (
        <RevenueCostForm
          details={cost.details as RevenueCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
      {cost.costType === 'tiered' && (
        <TieredCostForm
          details={cost.details as TieredCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
    </div>
  );
}

// Individual cost type forms
function FixedCostForm({ 
  details, 
  onUpdate 
}: { 
  details: FixedCost;
  onUpdate: (details: FixedCost) => void;
}) {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    console.log('Updating fixed cost amount:', amount);
    onUpdate({ ...details, amount });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.amount}
              onChange={handleAmountChange}
              className="pl-7 bg-transparent"
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Frequency</Label>
          <Select
            value={details.frequency}
            onValueChange={(frequency) => onUpdate({ ...details, frequency: frequency as 'monthly' | 'annual' })}
          >
            <SelectTrigger className="w-[120px] bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function UnitCostForm({ 
  details, 
  onUpdate 
}: { 
  details: UnitCost;
  onUpdate: (details: UnitCost) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Unit Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.unitPrice}
              onChange={(e) => onUpdate({ ...details, unitPrice: parseFloat(e.target.value) || 0 })}
              className="pl-7 bg-transparent"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex-1">
          <Label className="text-xs">Unit Type</Label>
          <Input
            value={details.unitType}
            onChange={(e) => onUpdate({ ...details, unitType: e.target.value })}
            className="bg-transparent"
            placeholder="e.g., transaction, account"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Minimum Units (Optional)</Label>
          <Input
            type="number"
            value={details.minimumUnits || ''}
            onChange={(e) => onUpdate({ ...details, minimumUnits: parseFloat(e.target.value) || undefined })}
            className="bg-transparent"
            placeholder="No minimum"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Maximum Units (Optional)</Label>
          <Input
            type="number"
            value={details.maximumUnits || ''}
            onChange={(e) => onUpdate({ ...details, maximumUnits: parseFloat(e.target.value) || undefined })}
            className="bg-transparent"
            placeholder="No maximum"
          />
        </div>
      </div>
    </div>
  );
}

function RevenueCostForm({ 
  details, 
  onUpdate 
}: { 
  details: RevenueCost;
  onUpdate: (details: RevenueCost) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Revenue Percentage</Label>
          <div className="relative">
            <Input
              type="number"
              value={details.percentage}
              onChange={(e) => onUpdate({ ...details, percentage: parseFloat(e.target.value) || 0 })}
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
        <div className="flex-1">
          <Label className="text-xs">Monthly Minimum (Optional)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.minimumMonthly || ''}
              onChange={(e) => onUpdate({ ...details, minimumMonthly: parseFloat(e.target.value) || undefined })}
              className="pl-7 bg-transparent"
              placeholder="No minimum"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TieredCostForm({ 
  details, 
  onUpdate 
}: { 
  details: TieredCost;
  onUpdate: (details: TieredCost) => void;
}) {
  const addTier = () => {
    const lastTier = details.tiers[details.tiers.length - 1];
    const newTier: TierRange = {
      min: lastTier.max || lastTier.min + 1,
      unitPrice: lastTier.unitPrice
    };
    onUpdate({
      ...details,
      tiers: [...details.tiers, newTier]
    });
  };

  const removeTier = (index: number) => {
    onUpdate({
      ...details,
      tiers: details.tiers.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Unit Type</Label>
          <Input
            value={details.unitType}
            onChange={(e) => onUpdate({ ...details, unitType: e.target.value })}
            className="bg-transparent"
            placeholder="e.g., transaction, account"
          />
        </div>
        <div>
          <Label className="text-xs">Monthly Minimum (Optional)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.minimumMonthly || ''}
              onChange={(e) => onUpdate({ ...details, minimumMonthly: parseFloat(e.target.value) || undefined })}
              className="pl-7 bg-transparent"
              placeholder="No minimum"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Pricing Tiers</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addTier}
            className="h-6 px-2"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {details.tiers.map((tier, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Min {details.unitType}s</Label>
              <Input
                type="number"
                value={tier.min}
                onChange={(e) => {
                  const newTiers = [...details.tiers];
                  newTiers[index] = { ...tier, min: parseFloat(e.target.value) || 0 };
                  onUpdate({ ...details, tiers: newTiers });
                }}
                className="bg-transparent"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Max {details.unitType}s (Optional)</Label>
              <Input
                type="number"
                value={tier.max || ''}
                onChange={(e) => {
                  const newTiers = [...details.tiers];
                  newTiers[index] = { ...tier, max: parseFloat(e.target.value) || undefined };
                  onUpdate({ ...details, tiers: newTiers });
                }}
                className="bg-transparent"
                placeholder="∞"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Price per Unit</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={tier.unitPrice}
                  onChange={(e) => {
                    const newTiers = [...details.tiers];
                    newTiers[index] = { ...tier, unitPrice: parseFloat(e.target.value) || 0 };
                    onUpdate({ ...details, tiers: newTiers });
                  }}
                  className="pl-7 bg-transparent"
                />
              </div>
            </div>
            {index > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTier(index)}
                className="h-10 px-2"
              >
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DueDiligenceSection({
  items,
  onUpdate,
  onAdd,
  onRemove
}: {
  items: DDItem[];
  onUpdate: (item: DDItem) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Due Diligence</Label>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onAdd}
          className="h-6 px-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <Input
                value={item.name}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                placeholder="DD item name"
                className="bg-transparent"
              />
              <Select
                value={item.status}
                onValueChange={(status) => onUpdate({ ...item, status: status as DDStatus })}
              >
                <SelectTrigger className="w-[130px] bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                className="h-6 px-2"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={item.notes}
              onChange={(e) => onUpdate({ ...item, notes: e.target.value })}
              placeholder="Additional notes..."
              className="min-h-[60px] text-sm bg-transparent"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => onUpdate({ ...item, dueDate: e.target.value })}
                  className="bg-transparent"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
