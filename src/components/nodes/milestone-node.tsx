"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { useMilestoneNode } from '@/hooks/useMilestoneNode';
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatHours } from "@/utils/utils";

const MilestoneNode = memo(({ id, data, selected }: NodeProps) => {
  // Use the hook to manage state and operations
  const {
    // Data
    title,
    description,
    status,
    metrics,
    
    // Actions
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    cycleStatus,
    
    // Utilities
    getStatusColor
  } = useMilestoneNode(id, data as RFMilestoneNodeData);

  // Calculate completion percentage
  const completionPercentage = metrics.nodeCount > 0
    ? (metrics.completedCount / metrics.nodeCount) * 100
    : 0;

  return (
    <BaseNode selected={selected} className="w-[350px]">
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="w-2 h-2 rounded-full border-2 border-background bg-primary"
      />

      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${getStatusColor(status)}`}
              onClick={cycleStatus}
              title="Click to advance status, Shift+Click to reverse"
            >
              {status}
            </Badge>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Milestone Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Milestone node menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <Textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Describe this milestone..."
          className="min-h-[80px] resize-y bg-transparent"
        />

        {/* Progress section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-xs"
              style={{ backgroundColor: getStatusColor(status) + '20', borderColor: getStatusColor(status) }}
            >
              {status.replace('_', ' ')}
            </Badge>
            
            {metrics.nodeCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {metrics.completedCount} of {metrics.nodeCount} completed
              </div>
            )}
          </div>
          
          {metrics.nodeCount > 0 && (
            <div className="w-full">
              <Progress value={completionPercentage} className="h-2" />
            </div>
          )}
        </div>

        {/* Cost and Revenue Summary */}
        <div className="space-y-3">
          <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
            <div>
              <div className="text-sm font-medium">Total Cost</div>
              <div className="text-xs text-muted-foreground">
                Team: ${metrics.teamCosts.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                {metrics.providerCosts > 0 && `, Providers: $${metrics.providerCosts.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">${metrics.totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
              {metrics.monthlyValue > 0 && (
                <div className="text-xs text-green-600">
                  +${metrics.monthlyValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}/mo
                </div>
              )}
            </div>
          </div>
          
          {/* Feature Allocations */}
          {metrics.featureAllocations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Feature Allocations</div>
              <div className="max-h-[200px] overflow-y-auto space-y-3 text-sm">
                {metrics.featureAllocations.map(feature => (
                  <div key={feature.featureId} className="space-y-1 border-b border-muted pb-2">
                    <div className="flex justify-between items-center">
                      <div className="font-medium">{feature.name}</div>
                      <div className="text-right font-mono">
                        ${feature.totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    
                    {feature.members.map(member => (
                      <div key={member.memberId} className="flex justify-between items-center text-xs pl-2">
                        <div>
                          <span>{member.name}</span>
                          <div className="text-xs text-muted-foreground">
                            {formatHours(member.hours)}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          ${member.cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Provider Costs */}
          {metrics.providerDetails.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Provider Costs</div>
              <div className="max-h-[100px] overflow-y-auto space-y-1 text-sm">
                {metrics.providerDetails.map(provider => (
                  <div key={provider.id} className="flex justify-between items-center text-xs p-1 border-b border-muted">
                    <div>
                      <span>{provider.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {provider.type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">
                        ${provider.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        {provider.type !== 'fixed' && '/mo'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Option Revenues */}
          {metrics.optionDetails.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Revenue Streams</div>
              <div className="max-h-[100px] overflow-y-auto space-y-1 text-sm">
                {metrics.optionDetails.map(option => (
                  <div key={option.id} className="flex justify-between items-center text-xs p-1 border-b border-muted">
                    <div>
                      <span>{option.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {option.transactionFeeRate}% of ${option.monthlyVolume.toLocaleString('en-US')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-green-600">
                        +${option.monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 2 })}/mo
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Bottom}
        id="target"
        className="w-2 h-2 rounded-full border-2 border-background bg-primary"
      />
    </BaseNode>
  );
});

MilestoneNode.displayName = 'MilestoneNode';

export { MilestoneNode };
