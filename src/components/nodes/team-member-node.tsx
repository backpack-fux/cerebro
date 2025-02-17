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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Common timezones - you might want to expand this list
const TIMEZONES = [
  'UTC-8 (PST)',
  'UTC-7 (MST)',
  'UTC-6 (CST)',
  'UTC-5 (EST)',
  'UTC+0 (GMT)',
  'UTC+1 (CET)',
  'UTC+2 (EET)',
  'UTC+5:30 (IST)',
  'UTC+8 (CST)',
  'UTC+9 (JST)',
  'UTC+10 (AEST)',
] as const;

export type TeamMemberNodeData = Node<{
  title: string;
  bio?: string;
  timezone?: string;
  dailyRate?: number;
}>;

export function TeamMemberNode({ id, data, selected }: NodeProps<TeamMemberNodeData>) {
  const { updateNodeData, setNodes } = useReactFlow();

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleBioChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, bio: e.target.value });
  }, [id, data, updateNodeData]);

  const handleTimezoneChange = useCallback((timezone: string) => {
    updateNodeData(id, { ...data, timezone });
  }, [id, data, updateNodeData]);

  const handleDailyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    if (!isNaN(rate)) {
      updateNodeData(id, { ...data, dailyRate: rate });
    }
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
            placeholder="Team Member Name"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Team member menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea
            value={data.bio || ''}
            onChange={handleBioChange}
            placeholder="Team member's bio..."
            className="min-h-[80px] resize-y bg-transparent"
          />
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select 
            value={data.timezone} 
            onValueChange={handleTimezoneChange}
          >
            <SelectTrigger className="bg-transparent">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Daily Rate</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={data.dailyRate || ''}
              onChange={handleDailyRateChange}
              className="pl-7 bg-transparent"
              placeholder="0.00"
              min={0}
              step={0.01}
            />
          </div>
        </div>
      </div>

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
