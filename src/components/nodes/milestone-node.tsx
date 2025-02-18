"use client";

import { Handle, Position, type NodeProps, type Node, useNodeConnections, useReactFlow } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCallback, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";

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

type MetricsState = {
  totalCost: number;
  monthlyValue: number;
  nodeCount: number;
  completedCount: number;
  statusCounts: Record<NodeStatus, number>;
  isComplete: boolean;
};

export function MilestoneNode({ id, data, selected }: NodeProps<MilestoneNodeData>) {
  const { updateNodeData, setNodes, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id });
  
  const { status, getStatusColor, cycleStatus, handleStatusChange } = useNodeStatus(id, data, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });

  // Get all connected nodes
  const connectedNodes = useMemo(() => {
    const targetConnections = connections.filter(c => c.target === id);
    return targetConnections.map(conn => 
      getNodes().find(n => n.id === conn.source)
    ).filter(Boolean);
  }, [connections, getNodes, id]);

  // Calculate total costs and value
  const metrics = useMemo(() => {
    return connectedNodes.reduce((acc: MetricsState, node: any) => {
      let nodeCosts = 0;
      console.log('Processing node:', node.type, node.data);
      
      // Handle provider costs
      if (node.type === 'provider') {
        // Debug provider costs array
        console.log('Provider costs array:', node.data.costs);
        
        nodeCosts = (node.data.costs || []).reduce((sum: number, cost: any) => {
          if (!cost?.details) {
            console.log('Invalid cost structure:', cost);
            return sum;
          }

          console.log('Processing cost:', cost.name, cost.details);
          switch (cost.details.type) {
            case 'fixed':
              const fixedCost = (cost.details.amount || 0) * (cost.details.frequency === 'annual' ? 1/12 : 1);
              console.log('Fixed cost calculated:', fixedCost);
              return sum + fixedCost;
            case 'unit':
              const unitCost = (cost.details.unitPrice || 0) * (cost.details.minimumUnits || 0);
              console.log('Unit cost calculated:', unitCost);
              return sum + unitCost;
            case 'revenue':
              const revenueCost = (cost.details.minimumMonthly || 0);
              console.log('Revenue cost calculated:', revenueCost);
              return sum + revenueCost;
            case 'tiered':
              const tieredCost = (cost.details.minimumMonthly || 0);
              console.log('Tiered cost calculated:', tieredCost);
              return sum + tieredCost;
            default:
              return sum;
          }
        }, 0);
      }

      // Calculate team allocation costs
      const teamCosts = (node.data.memberAllocations || []).reduce((sum: number, allocation: any) => {
        // Debug team member lookup
        console.log('Looking for team member:', allocation.memberId);
        console.log('All nodes:', getNodes().map(n => ({ id: n.id, type: n.type })));
        
        const teamMemberNode = getNodes().find(n => {
          const isMatch = n.type === 'teamMember' && n.id === allocation.memberId;
          console.log('Checking node:', n.id, n.type, 'isMatch:', isMatch, {
            expectedType: 'teamMember',
            actualType: n.type,
            expectedId: allocation.memberId,
            actualId: n.id
          });
          return isMatch;
        });

        if (teamMemberNode) {
          const dailyRate = Number(teamMemberNode.data.dailyRate) || 0;
          const timePercentage = Number(allocation.timePercentage) || 0;
          const duration = Number(node.data.duration) || 0;
          const memberCost = dailyRate * (timePercentage / 100) * duration;
          console.log('Team member cost calculated:', {
            memberId: allocation.memberId,
            dailyRate,
            timePercentage,
            duration,
            memberCost
          });
          return sum + memberCost;
        } else {
          console.log('Team member node not found:', allocation.memberId);
        }
        return sum;
      }, 0);
      console.log('Total team costs:', teamCosts);

      // Calculate expected value (from option nodes)
      const monthlyValue = node.type === 'option' 
        ? ((node.data.transactionFeeRate || 0) / 100) * (node.data.monthlyVolume || 0)
        : 0;
      console.log('Monthly value calculated:', monthlyValue);

      // Enhanced status tracking with proper typing
      const nodeStatus = (node.data.status || 'planning') as NodeStatus;
      const statusCounts: Record<NodeStatus, number> = {
        ...acc.statusCounts,
        [nodeStatus]: (acc.statusCounts[nodeStatus] || 0) + 1
      };

      return {
        totalCost: acc.totalCost + nodeCosts + teamCosts,
        monthlyValue: acc.monthlyValue + monthlyValue,
        nodeCount: acc.nodeCount + 1,
        completedCount: acc.completedCount + (
          node.data.status === 'completed' || node.data.status === 'active' ? 1 : 0
        ),
        statusCounts,
        isComplete: acc.nodeCount > 0 && acc.completedCount === acc.nodeCount
      };
    }, {
      totalCost: 0,
      monthlyValue: 0,
      nodeCount: 0,
      completedCount: 0,
      statusCounts: {
        planning: 0,
        in_progress: 0,
        completed: 0,
        active: 0
      },
      isComplete: false
    });
  }, [connectedNodes, getNodes]);

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

        {/* Metrics Summary */}
        <div className="space-y-2">
          <Label>Milestone Metrics</Label>
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Total Cost</Label>
                <div className="text-sm font-mono">
                  ${metrics.totalCost.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monthly Value</Label>
                <div className="text-sm font-mono">
                  ${metrics.monthlyValue.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Completion</span>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(metrics.statusCounts).map(([status, count]) => (
                      <span key={status} className="mr-2">
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                  <Badge 
                    variant={metrics.isComplete ? "default" : "secondary"}
                  >
                    {metrics.completedCount}/{metrics.nodeCount} nodes
                  </Badge>
                </div>
              </div>
              {metrics.nodeCount > 0 && (
                <div className="w-full bg-muted/30 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ 
                      width: `${(metrics.completedCount / metrics.nodeCount) * 100}%` 
                    }}
                  />
                </div>
              )}
            </div>
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
