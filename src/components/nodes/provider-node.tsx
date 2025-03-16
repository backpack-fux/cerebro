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
import { useMemo, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
import { useReactFlow } from "@xyflow/react";
import { CostReceipt } from '@/components/shared/CostReceipt';
import { TeamAllocation } from '@/components/shared/TeamAllocation';
import { formatHours} from '@/utils/format-utils';
import { formatMemberName } from '@/utils/node-utils';
import type { TeamAllocation as ITeamAllocation } from '@/utils/types/allocation';

// Use React.memo to prevent unnecessary re-renders
export const ProviderNode = memo(function ProviderNode({ id, data, selected }: NodeProps) {
  // Use our custom hook for provider node logic
  const provider = useProviderNode(id, data as RFProviderNodeData);
  const { getNodes } = useReactFlow();
  
  // Calculate project duration in days
  const projectDurationDays = Number(data.duration) || 1;
  
  // Pre-calculate member allocations for display and cost calculation
  const memberAllocations = useMemo(() => {
    if (!provider.calculateMemberAllocations) return new Map();
    
    return provider.calculateMemberAllocations(
      provider.connectedTeams,
      provider.processedTeamAllocations,
      projectDurationDays,
      formatMemberName
    );
  }, [
    provider.connectedTeams, 
    provider.processedTeamAllocations, 
    projectDurationDays, 
    formatMemberName,
    provider.calculateMemberAllocations
  ]);
  
  // Calculate cost summary
  const costSummary = useMemo(() => {
    if (!provider.calculateCostSummary) {
      return { totalCost: 0, totalHours: 0, totalDays: 0, allocations: [] };
    }
    
    return provider.calculateCostSummary(memberAllocations);
  }, [memberAllocations, provider.calculateCostSummary]);
  
  return (
    <BaseNode selected={selected} className="w-[400px]">
      <Handle type="source" position={Position.Top} id="source" />
      <Handle type="target" position={Position.Bottom} id="target" />
      
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
              className="bg-transparent outline-none w-full"
              placeholder="Provider Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <button 
            onClick={provider.refreshData}
            className="p-1 rounded-md hover:bg-muted"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NodeHeaderMenuAction label="Provider Actions">
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={provider.handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="p-4 space-y-4">
        <Textarea
          value={provider.description}
          onChange={(e) => provider.handleDescriptionChange(e.target.value)}
          placeholder="Describe this provider..."
          className="min-h-[80px] resize-none"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{provider.duration.config.label}</Label>
            <Badge variant="outline" className="font-mono">
              {provider.duration.displayValue}
            </Badge>
          </div>
          <Input
            type="text"
            value={provider.duration.value || ''}
            onChange={(e) => provider.duration.handleDurationChange(e.target.value)}
            onKeyDown={provider.duration.handleDurationKeyDown}
            className="bg-transparent"
            placeholder="e.g. 12 or 2w"
          />
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

        {/* Resource Allocation Section */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>Resource Allocation</span>
            <Badge variant="outline" className="font-mono">
              {formatHours(costSummary.totalHours)}
            </Badge>
          </Label>
          
          {provider.connectedTeams.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          )}
          
          {provider.connectedTeams.map(team => (
            <TeamAllocation
              key={team.teamId}
              team={team}
              teamAllocation={provider.processedTeamAllocations.find((a: ITeamAllocation) => a.teamId === team.teamId)}
              memberAllocations={memberAllocations}
              projectDurationDays={projectDurationDays}
              formatMemberName={formatMemberName}
              onMemberValueChange={(teamId, memberId, hours) => {
                provider.handleAllocationChangeLocal(teamId, memberId, hours);
              }}
              onMemberValueCommit={(teamId, memberId, hours) => {
                provider.handleAllocationCommit(teamId, memberId, hours);
              }}
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
      </div>
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
                <SelectItem value="fixed">Fixed Cost</SelectItem>
                <SelectItem value="unit">Per Unit</SelectItem>
                <SelectItem value="revenue">Revenue Share</SelectItem>
                <SelectItem value="tiered">Tiered Pricing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Render the appropriate form based on cost type */}
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
    if (!isNaN(amount)) {
      onUpdate({ ...details, amount });
    }
  };
  
  const handleFrequencyChange = (frequency: 'monthly' | 'annual') => {
    onUpdate({ ...details, frequency });
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.amount || ''}
              onChange={handleAmountChange}
              className="pl-7 h-8"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">Frequency</Label>
          <Select
            value={details.frequency}
            onValueChange={handleFrequencyChange}
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
  const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const unitPrice = parseFloat(e.target.value);
    if (!isNaN(unitPrice)) {
      onUpdate({ ...details, unitPrice });
    }
  };
  
  const handleUnitTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...details, unitType: e.target.value });
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Price per Unit</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.unitPrice || ''}
              onChange={handleUnitPriceChange}
              className="pl-7 h-8"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">Unit Type</Label>
          <Input
            value={details.unitType || ''}
            onChange={handleUnitTypeChange}
            className="h-8"
            placeholder="e.g. user, transaction"
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
  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseFloat(e.target.value);
    if (!isNaN(percentage)) {
      onUpdate({ ...details, percentage });
    }
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Revenue Percentage</Label>
          <div className="relative">
            <Input
              type="number"
              value={details.percentage || ''}
              onChange={handlePercentageChange}
              className="pr-8 h-8"
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
    const newMin = lastTier ? lastTier.min + 100 : 0;
    
    const updatedTiers = [
      ...details.tiers,
      { min: newMin, unitPrice: 0 }
    ];
    
    onUpdate({ ...details, tiers: updatedTiers });
  };
  
  const removeTier = (index: number) => {
    const updatedTiers = details.tiers.filter((_, i) => i !== index);
    onUpdate({ ...details, tiers: updatedTiers });
  };
  
  const updateTier = (index: number, updates: Partial<TierRange>) => {
    const updatedTiers = details.tiers.map((tier, i) => 
      i === index ? { ...tier, ...updates } : tier
    );
    
    onUpdate({ ...details, tiers: updatedTiers });
  };
  
  const handleUnitTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...details, unitType: e.target.value });
  };
  
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Unit Type</Label>
        <Input
          value={details.unitType || ''}
          onChange={handleUnitTypeChange}
          className="h-8"
          placeholder="e.g. user, transaction"
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Pricing Tiers</Label>
          <Button 
            variant="outline" 
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
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min {details.unitType || 'units'}</Label>
                  <Input
                    type="number"
                    value={tier.min}
                    onChange={(e) => updateTier(index, { min: parseInt(e.target.value) })}
                    className="h-7"
                    min={0}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Price per Unit</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={tier.unitPrice}
                      onChange={(e) => updateTier(index, { unitPrice: parseFloat(e.target.value) })}
                      className="pl-5 h-7"
                      min={0}
                      step={0.01}
                    />
                  </div>
                </div>
              </div>
              
              {details.tiers.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => removeTier(index)}
                  className="h-7 w-7 p-0 self-end"
                >
                  <Trash className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Due Diligence Section
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
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No due diligence items yet
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
              <Input
                value={item.name || ''}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                className="flex-1 h-8 bg-transparent"
                placeholder="Due diligence item..."
              />
              
              <Select
                value={item.status}
                onValueChange={(value) => onUpdate({ ...item, status: value as DDStatus })}
              >
                <SelectTrigger className="w-[100px] h-8">
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
                className="h-8 w-8 p-0"
              >
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProviderNode;
