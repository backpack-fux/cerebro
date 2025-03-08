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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { useMilestoneNode } from '@/hooks/useMilestoneNode';

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

  return (
    <BaseNode selected={selected}>
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

        <div className="space-y-2">
          <Label>Milestone Metrics</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Cost</div>
              <div className="font-mono">
                ${metrics.totalCost.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Monthly Value</div>
              <div className="font-mono">
                ${metrics.monthlyValue.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Completion: {metrics.statusCounts.planning} planning, {metrics.statusCounts.in_progress} in progress, {metrics.statusCounts.completed} completed, {metrics.statusCounts.active} active ({metrics.nodeCount} nodes)
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
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

MilestoneNode.displayName = 'MilestoneNode';

export { MilestoneNode };
