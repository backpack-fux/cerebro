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
import { useState, useMemo, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  RFProviderNodeData, 
  ProviderCost, 
  DDItem, 
  CostType, 
  FixedCost, 
  UnitCost, 
  RevenueCost, 
  TieredCost, 
  DDStatus,
  TierRange
} from '@/services/graph/provider/provider.types';
import { useProviderNode } from '@/hooks/useProviderNode';

// Use React.memo to prevent unnecessary re-renders
const ProviderNode = memo(function ProviderNode({ id, data, selected }: NodeProps) {
  // Use our custom hook for provider node logic
  const provider = useProviderNode(id, data as RFProviderNodeData);
  
  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${provider.getStatusColor(provider.status)}`}
              onClick={provider.cycleStatus}
            >
              {provider.status}
            </Badge>
            <input
              value={provider.title}
              onChange={(e) => provider.handleTitleChange(e.target.value)}
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Provider Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Provider node menu">
            <DropdownMenuItem onSelect={provider.handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <Textarea
          value={provider.description}
          onChange={(e) => provider.handleDescriptionChange(e.target.value)}
          placeholder="Describe this provider..."
          className="min-h-[100px] w-full resize-y bg-transparent"
        />

        <div className="space-y-2">
          <Label>{provider.duration.config.label}</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={provider.duration.value || ''}
                onChange={(e) => provider.duration.handleDurationChange(e.target.value)}
                onKeyDown={provider.duration.handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {provider.duration.displayValue}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {provider.duration.config.tip} Max {provider.duration.formatDuration(provider.duration.config.maxDays)}
            </p>
          </div>
        </div>

        {/* Cost Structure Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Cost Structure</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={provider.addCost}
              className="h-7 px-2"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Cost
            </Button>
          </div>
          
          <div className="space-y-4">
            {provider.processedCosts.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No costs defined yet
              </div>
            ) : (
              provider.processedCosts.map((cost) => (
                <CostStructure 
                  key={cost.id} 
                  cost={cost} 
                  onUpdate={(updates) => provider.updateCost(cost.id, updates)} 
                  onRemove={() => provider.removeCost(cost.id)} 
                />
              ))
            )}
          </div>
        </div>

        {/* Due Diligence Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Due Diligence</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={provider.addDDItem}
              className="h-7 px-2"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
          </div>
          
          <DueDiligenceSection 
            items={provider.processedDDItems}
            onUpdate={provider.updateDDItem}
            onAdd={provider.addDDItem}
            onRemove={provider.removeDDItem}
          />
        </div>

        {/* Team Allocations */}
        <div className="space-y-2">
          <Label>Team Allocations</Label>
          
          {provider.connectedTeams.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          ) : (
            <div className="space-y-4">
              {provider.connectedTeams.map(team => (
                <div key={team.teamId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team.name}</span>
                  </div>

                  {/* Member Allocation Controls */}
                  <div className="space-y-4">
                    {team.availableBandwidth.map(member => {
                      // Memoize the allocation lookup and percentage calculation
                      const { percentage, availableHours } = useMemo(() => {
                        const allocation = provider.processedTeamAllocations
                          .find(a => a.teamId === team.teamId)
                          ?.allocatedMembers
                          .find((m: { memberId: string }) => m.memberId === member.memberId);
                        
                        const percentage = allocation 
                          ? (allocation.hours / 8 / ((data as RFProviderNodeData).duration || 1)) * 100 
                          : 0;

                        return { 
                          percentage, 
                          availableHours: member.availableHours 
                        };
                      }, [
                        member.memberId, 
                        team.teamId, 
                        provider.processedTeamAllocations, 
                        (data as RFProviderNodeData).duration
                      ]);

                      return (
                        <div key={member.memberId} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{member.name}</span>
                            <span className="text-muted-foreground">
                              {percentage.toFixed(0)}% ({availableHours}h available)
                            </span>
                          </div>
                          <Slider
                            value={[percentage]}
                            onValueChange={([value]) => {
                              const teamId = team.teamId;
                              const hoursRequested = (value / 100) * 8 * ((data as RFProviderNodeData).duration || 1);
                              provider.updateMemberAllocation(teamId, member.memberId, hoursRequested);
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
        {provider.costs && provider.costs.allocations.length > 0 && (
          <provider.CostSummary costs={provider.costs} duration={(data as RFProviderNodeData).duration} />
        )}
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

// Cost Structure Component
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
    let details: FixedCost | UnitCost | RevenueCost | TieredCost;
    
    switch (type) {
      case 'fixed':
        details = { type: 'fixed', amount: 0, frequency: 'monthly' };
        break;
      case 'unit':
        details = { type: 'unit', unitPrice: 0, unitType: 'user' };
        break;
      case 'revenue':
        details = { type: 'revenue', percentage: 0 };
        break;
      case 'tiered':
        details = { type: 'tiered', unitType: 'user', tiers: [{ min: 0, unitPrice: 0 }] };
        break;
      default:
        details = { type: 'fixed', amount: 0, frequency: 'monthly' };
    }
    
    onUpdate({ costType: type, details });
  };
  
  return (
    <div className="space-y-3 border rounded-md p-3">
      <div className="flex items-center justify-between">
        <Input
          value={cost.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="bg-transparent border-none h-7 p-0 text-sm font-medium"
          placeholder="Cost Name"
        />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRemove}
          className="h-7 w-7 p-0"
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={cost.costType}
              onValueChange={(value) => handleTypeChange(value as CostType)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="unit">Per Unit</SelectItem>
                <SelectItem value="revenue">Revenue Share</SelectItem>
                <SelectItem value="tiered">Tiered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
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
    </div>
  );
}

// Fixed Cost Form
function FixedCostForm({ 
  details, 
  onUpdate 
}: { 
  details: FixedCost;
  onUpdate: (details: FixedCost) => void;
}) {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value);
    onUpdate({ ...details, amount: isNaN(amount) ? 0 : amount });
  };
  
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Amount</Label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            type="number"
            value={details.amount}
            onChange={handleAmountChange}
            className="pl-6 h-8"
          />
        </div>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">Frequency</Label>
        <Select
          value={details.frequency}
          onValueChange={(value) => onUpdate({ ...details, frequency: value as 'monthly' | 'annual' })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Unit Cost Form
function UnitCostForm({ 
  details, 
  onUpdate 
}: { 
  details: UnitCost;
  onUpdate: (details: UnitCost) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Unit Type</Label>
          <Input
            value={details.unitType}
            onChange={(e) => onUpdate({ ...details, unitType: e.target.value })}
            className="h-8"
            placeholder="e.g. user, transaction"
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">Price Per Unit</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={details.unitPrice}
              onChange={(e) => onUpdate({ 
                ...details, 
                unitPrice: parseFloat(e.target.value) || 0 
              })}
              className="pl-6 h-8"
            />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Minimum Units</Label>
          <Input
            type="number"
            value={details.minimumUnits || ''}
            onChange={(e) => onUpdate({ 
              ...details, 
              minimumUnits: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            className="h-8"
            placeholder="Optional"
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">Maximum Units</Label>
          <Input
            type="number"
            value={details.maximumUnits || ''}
            onChange={(e) => onUpdate({ 
              ...details, 
              maximumUnits: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            className="h-8"
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );
}

// Revenue Cost Form
function RevenueCostForm({ 
  details, 
  onUpdate 
}: { 
  details: RevenueCost;
  onUpdate: (details: RevenueCost) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Percentage</Label>
        <div className="relative">
          <Input
            type="number"
            value={details.percentage}
            onChange={(e) => onUpdate({ 
              ...details, 
              percentage: parseFloat(e.target.value) || 0 
            })}
            className="pr-6 h-8"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
        </div>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">Minimum Monthly</Label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            type="number"
            value={details.minimumMonthly || ''}
            onChange={(e) => onUpdate({ 
              ...details, 
              minimumMonthly: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            className="pl-6 h-8"
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );
}

// Tiered Cost Form
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
      min: lastTier.max ? lastTier.max : lastTier.min + 1,
      unitPrice: lastTier.unitPrice
    };
    
    onUpdate({
      ...details,
      tiers: [...details.tiers, newTier]
    });
  };
  
  const removeTier = (index: number) => {
    if (details.tiers.length <= 1) return;
    
    onUpdate({
      ...details,
      tiers: details.tiers.filter((_, i) => i !== index)
    });
  };
  
  const updateTier = (index: number, updates: Partial<TierRange>) => {
    onUpdate({
      ...details,
      tiers: details.tiers.map((tier, i) => 
        i === index ? { ...tier, ...updates } : tier
      )
    });
  };
  
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Unit Type</Label>
        <Input
          value={details.unitType}
          onChange={(e) => onUpdate({ ...details, unitType: e.target.value })}
          className="h-8"
          placeholder="e.g. user, transaction"
        />
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Tiers</Label>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={addTier}
            className="h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Tier
          </Button>
        </div>
        
        <div className="space-y-2">
          {details.tiers.map((tier, index) => (
            <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">{index === 0 ? 'Min' : 'From'}</Label>
                <Input
                  type="number"
                  value={tier.min}
                  onChange={(e) => updateTier(index, { min: parseInt(e.target.value) || 0 })}
                  className="h-8"
                  disabled={index === 0}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">{index === details.tiers.length - 1 ? 'And Above' : 'To'}</Label>
                <Input
                  type="number"
                  value={tier.max || ''}
                  onChange={(e) => updateTier(index, { 
                    max: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="h-8"
                  disabled={index === details.tiers.length - 1}
                  placeholder={index === details.tiers.length - 1 ? "∞" : ""}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="space-y-1">
                  <Label className="text-xs">Price</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={tier.unitPrice}
                      onChange={(e) => updateTier(index, { 
                        unitPrice: parseFloat(e.target.value) || 0 
                      })}
                      className="pl-6 h-8 w-20"
                    />
                  </div>
                </div>
                
                {details.tiers.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeTier(index)}
                    className="h-8 w-8 p-0 mt-5"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">Minimum Monthly</Label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            type="number"
            value={details.minimumMonthly || ''}
            onChange={(e) => onUpdate({ 
              ...details, 
              minimumMonthly: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            className="pl-6 h-8"
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );
}

// Due Diligence Section Component
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
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No due diligence items defined yet
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="border rounded-md p-2 space-y-2">
          <div className="flex items-center justify-between">
            <Input
              value={item.name}
              onChange={(e) => onUpdate({ ...item, name: e.target.value })}
              className="bg-transparent border-none h-7 p-0 text-sm font-medium"
              placeholder="Item Name"
            />
            <div className="flex items-center space-x-2">
              <Select
                value={item.status}
                onValueChange={(value) => onUpdate({ ...item, status: value as DDStatus })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Status" />
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
                className="h-7 w-7 p-0"
              >
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          
          <Textarea
            value={item.notes || ''}
            onChange={(e) => onUpdate({ ...item, notes: e.target.value })}
            placeholder="Notes..."
            className="min-h-[60px] text-sm"
          />
        </div>
      ))}
    </div>
  );
}

// Export the memoized component
export { ProviderNode };
