// MetaNode.tsx (updated)
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { useMetaNode } from '@/hooks/useMetaNode';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * MetaNode component for displaying and editing meta information
 * Uses useMetaNode hook for domain logic and state management
 */
const MetaNode = memo(({ id, data }: NodeProps) => {
  const {
    title,
    description,
    connectedEdges,
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    handleDisconnect
  } = useMetaNode(id, data as RFMetaNodeData);

  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 w-[300px]">
      <div className="flex justify-between items-center mb-2">
        <Input
          className="font-medium text-lg border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Meta Node Title"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => handleDelete()}
            >
              Delete
            </DropdownMenuItem>
            {connectedEdges.map((edge) => (
              <DropdownMenuItem
                key={edge.id}
                onClick={() => handleDisconnect(edge.id)}
              >
                Disconnect {edge.source === id ? 'from' : 'to'}{' '}
                {edge.source === id ? edge.target : edge.source}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        className="min-h-[100px] border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        placeholder="Add a description..."
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
});

MetaNode.displayName = 'MetaNode';

export { MetaNode };