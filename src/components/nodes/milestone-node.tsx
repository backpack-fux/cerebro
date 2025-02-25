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
import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useMilestoneMetrics } from "@/hooks/useMilestoneMetrics";
import { MilestoneHandlers } from '@/services/graph/milestone/milestone.handlers';
import { useEdges } from "@xyflow/react";

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
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  const metrics = useMilestoneMetrics(id);
  
  // Local state for title, description, and status to avoid excessive API calls
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const statusDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(data.title);
    setDescription(data.description || '');
  }, [data.title, data.description]);
  
  // Override the handleStatusChange to include API persistence
  const persistStatusChange = useCallback((newStatus: NodeStatus) => {
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, status: newStatus });
    
    // Clear any existing debounce timer
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current);
    }
    
    // Set a new debounce timer
    statusDebounceRef.current = setTimeout(async () => {
      try {
        // Persist the change to the database
        await MilestoneHandlers.update({ 
          id, 
          status: newStatus 
        });
        console.log(`Updated milestone ${id} status to "${newStatus}"`);
      } catch (error) {
        console.error(`Failed to update milestone ${id} status:`, error);
      }
      statusDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData]);

  // Create a wrapper function that matches the signature expected by useNodeStatus
  const handleNodeStatusChange = useCallback((nodeId: string, nodeData: any) => {
    if (nodeData.status && typeof nodeData.status === 'string') {
      persistStatusChange(nodeData.status as NodeStatus);
    }
  }, [persistStatusChange]);

  // Use the standard hook with our wrapper
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    data, 
    handleNodeStatusChange, 
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );

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
        persistStatusChange(newStatus);
      }
    }
  }, [metrics.completedCount, metrics.nodeCount, status, persistStatusChange]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    // Update local state immediately for responsive UI
    setTitle(newTitle);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, title: newTitle });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newTitle !== data.title) {
          // Persist the change to the database
          await MilestoneHandlers.update({ 
            id, 
            title: newTitle 
          });
          console.log(`Updated milestone ${id} title to "${newTitle}"`);
        }
      } catch (error) {
        console.error(`Failed to update milestone ${id}:`, error);
      }
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    // Update local state immediately for responsive UI
    setDescription(newDescription);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, description: newDescription });
    
    // Clear any existing debounce timer
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }
    
    // Set a new debounce timer
    descriptionDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newDescription !== data.description) {
          // Persist the change to the database
          await MilestoneHandlers.update({ 
            id, 
            description: newDescription 
          });
          console.log(`Updated milestone ${id} description`);
        }
      } catch (error) {
        console.error(`Failed to update milestone ${id} description:`, error);
      }
      descriptionDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
    };
  }, []);

  const handleDelete = useCallback(() => {
    // First delete the node from the database
    MilestoneHandlers.delete(id)
      .then(() => {
        console.log(`Successfully deleted milestone node ${id}`);
        // Then remove it from the UI
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete associated edges
        const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
        connectedEdges.forEach((edge) => {
          MilestoneHandlers.deleteMilestoneEdge(edge.id)
            .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
        });
      })
      .catch((error) => {
        console.error(`Failed to delete milestone node ${id}:`, error);
      });
  }, [id, setNodes, edges]);

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
          value={description}
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
