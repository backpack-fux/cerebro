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
import { memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { useSynapsoTeamMemberNode } from '@/hooks/useSynapsoTeamMemberNode';

// Use React.memo to prevent unnecessary re-renders
const SynapsoTeamMemberNode = memo(function SynapsoTeamMemberNode({ id, data, selected }: NodeProps) {
  // Extract the workflowId from data, defaulting to an empty string if not available
  const workflowId = (data as any)?.workflowId || '';
  
  // Use our custom Synapso hook for team member node logic
  const member = useSynapsoTeamMemberNode(id, workflowId);
  
  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={member.title}
            onChange={(e) => member.handleTitleChange(e.target.value)}
            className="bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Team Member Name"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <Badge variant="secondary" className="mr-2">
            <User className="h-3 w-3 mr-1" />
            Team Member
          </Badge>
          <NodeHeaderMenuAction label="Team Member menu">
            <DropdownMenuItem onSelect={member.handleDelete} className="cursor-pointer text-red-500">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`role-${id}`}>Role</Label>
          <Input
            id={`role-${id}`}
            value={member.role}
            onChange={(e) => member.handleRoleChange(e.target.value)}
            placeholder="Enter role..."
            className="bg-transparent"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor={`capacity-${id}`}>Weekly Capacity (hours)</Label>
          <Input
            id={`capacity-${id}`}
            type="number"
            min={0}
            max={168}
            value={member.weeklyCapacity}
            onChange={(e) => member.handleWeeklyCapacityChange(parseInt(e.target.value, 10))}
            className="bg-transparent"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`description-${id}`}>Description</Label>
          <Textarea
            id={`description-${id}`}
            value={member.description}
            onChange={(e) => member.handleDescriptionChange(e.target.value)}
            placeholder="Team member description..."
            className="min-h-[80px] resize-y bg-transparent"
          />
        </div>
        
        {member.isOffline && (
          <div className="text-xs p-2 bg-yellow-500/10 text-yellow-600 rounded">
            You're working offline. Changes will sync when reconnected.
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-primary"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="w-3 h-3 bg-primary"
      />
    </BaseNode>
  );
});

// Export the memoized component
export { SynapsoTeamMemberNode }; 