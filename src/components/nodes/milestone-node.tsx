"use client";

import { Handle, Position, type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useMilestoneMetrics } from "@/hooks/useMilestoneMetrics";

type KPI = {
  id: string;
  name: string;
  target: number;
  unit: string;
};

export type MilestoneNodeData = Node<{
  title: string;
  description?: string;
  kpis?: KPI[];
  status?: string;
}>;

export function MilestoneNode({ id, data, selected }: NodeProps<MilestoneNodeData>) {
  const { updateNodeData, setNodes } = useReactFlow();
  const metrics = useMilestoneMetrics(id);
  
  const { status, getStatusColor, cycleStatus, handleStatusChange } = useNodeStatus(id, data, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });

  // Auto-update milestone status based on connected nodes
  useEffect(() => {
    if (metrics.nodeCount > 0) {
      let newStatus: NodeStatus = 'planning';
      
      const completionPercentage = (metrics.completedCount / metrics.nodeCount) * 100;
      
      if (completionPercentage === 100) {
        newStatus = 'completed';
      } else if (completionPercentage > 0) {
        newStatus = 'in_progress';
      }

      if (newStatus !== status) {
        handleStatusChange(newStatus);
      }
    }
  }, [metrics.completedCount, metrics.nodeCount, status, handleStatusChange]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, description: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

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
              value={data.title}
              onChange={handleTitleChange}
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
          value={data.description || ''}
          onChange={handleDescriptionChange}
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
}
