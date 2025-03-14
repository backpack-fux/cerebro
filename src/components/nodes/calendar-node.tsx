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

export type CalendarNodeData = Node<{
  title: string;
  description?: string;
}>;

export function CalendarNode({ id, data, selected }: NodeProps<CalendarNodeData>) {
  const { updateNodeData, setNodes } = useReactFlow();

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={data.title}
            onChange={handleTitleChange}
            className="bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Calendar Event"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Calendar node menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <Handle
        type="target"
        position={Position.Top}
        id="target"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
      />
    </BaseNode>
  );
} 