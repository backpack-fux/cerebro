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
import { memo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code, Trash } from "lucide-react";
import { useSynapso } from '@/hooks/useSynapso';

// Use React.memo to prevent unnecessary re-renders
const SynapsoLogicNode = memo(function SynapsoLogicNode({ id, data, selected }: NodeProps) {
  // Extract data properties with defaults
  const nodeData = data || {};
  const workflowId = (nodeData as any).workflowId || '';
  const [title, setTitle] = useState((nodeData as any).title || 'Logic Node');
  const [logic, setLogic] = useState((nodeData as any).logic || '// Add your custom logic here\n');
  
  // Use Synapso service for data operations
  const { updateNode, deleteNode } = useSynapso({ 
    workflowId, 
    enableRealtime: true 
  });
  
  // Handle node title change with debounce
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    updateNodeData(newTitle, logic);
  };
  
  // Handle logic code change with debounce
  const handleLogicChange = (newLogic: string) => {
    setLogic(newLogic);
    updateNodeData(title, newLogic);
  };
  
  // Update node data
  const updateNodeData = async (newTitle: string, newLogic: string) => {
    try {
      await updateNode(id, {
        data: {
          ...nodeData,
          title: newTitle,
          logic: newLogic,
        }
      });
    } catch (error) {
      console.error('Failed to update logic node:', error);
    }
  };
  
  // Handle node deletion
  const handleDelete = async () => {
    try {
      await deleteNode(id, workflowId);
    } catch (error) {
      console.error('Failed to delete logic node:', error);
    }
  };
  
  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Logic Node"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <Badge variant="secondary" className="mr-2">
            <Code className="h-3 w-3 mr-1" />
            Logic
          </Badge>
          <NodeHeaderMenuAction label="Logic menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer text-red-500">
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`logic-${id}`} className="text-xs">Logic Code</Label>
          <div className="relative rounded-md border bg-muted/50">
            <Textarea
              id={`logic-${id}`}
              value={logic}
              onChange={(e) => handleLogicChange(e.target.value)}
              placeholder="// Add your custom business logic here"
              className="min-h-[120px] font-mono text-xs bg-transparent resize-y p-3"
            />
          </div>
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => console.log('Execute logic - will connect to Synapso execution')}
            >
              Execute Logic
            </Button>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="w-3 h-3 bg-blue-500"
      />
    </BaseNode>
  );
});

// Export the memoized component
export { SynapsoLogicNode }; 