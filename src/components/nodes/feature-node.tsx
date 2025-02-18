"use client";

import { Handle, Position, type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandList,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useNodeStatus } from "@/hooks/useNodeStatus";

export type BuildType = 'internal' | 'external';
export type TimeUnit = 'days' | 'weeks';

// Add this type to define member allocation
type MemberAllocation = {
  memberId: string;
  timePercentage: number;
};

// Update FeatureNodeData to include allocations
export type FeatureNodeData = Node<{
  title: string;
  description?: string;
  buildType?: BuildType;
  cost?: number;
  duration?: number;
  timeUnit?: TimeUnit;
  teamMembers?: string[]; // Array of team member node IDs
  memberAllocations?: MemberAllocation[]; // Add this field
}>;

export function FeatureNode({ id, data, selected }: NodeProps<FeatureNodeData>) {
  const { updateNodeData, setNodes } = useReactFlow();
  const [open, setOpen] = useState(false);
  
  const {
    teamMembers,
    selectedMembers,
    handleAllocationChange,
    costs,
    CostSummary
  } = useTeamAllocation(id, data);

  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, data, updateNodeData, {
    canBeActive: true, // Features can be "active" after completion
    defaultStatus: 'planning'
  });

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, description: e.target.value });
  }, [id, data, updateNodeData]);

  const handleBuildTypeChange = useCallback((value: BuildType) => {
    updateNodeData(id, { ...data, buildType: value });
  }, [id, data, updateNodeData]);

  const duration = useDurationInput(id, data, updateNodeData, {
    maxDays: 72,
    label: "Time to Build",
    fieldName: "duration",
    tip: 'Use "w" for weeks (e.g. "2w" = 2 weeks) or ↑↓ keys. Hold Shift for week increments.'
  });

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
            >
              {status}
            </Badge>
            <input
              value={data.title}
              onChange={handleTitleChange}
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Feature Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Feature node menu">
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
          placeholder="Describe this feature..."
          className="min-h-[100px] w-full resize-y bg-transparent"
        />

        <div className="space-y-2">
          <Label>Build Type</Label>
          <RadioGroup
            value={data.buildType}
            onValueChange={handleBuildTypeChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="internal" id="internal" />
              <Label htmlFor="internal">Internal</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="external" id="external" />
              <Label htmlFor="external">External</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>{duration.config.label}</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={duration.value || ''}
                onChange={(e) => duration.handleDurationChange(e.target.value)}
                onKeyDown={duration.handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {duration.displayValue}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {duration.config.tip} Max {duration.formatDuration(duration.config.maxDays)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Build Roster</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between bg-transparent"
              >
                {selectedMembers.length > 0
                  ? `${selectedMembers.length} team member${selectedMembers.length === 1 ? '' : 's'}`
                  : "Select team members..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search team members..." />
                <CommandList>
                  <CommandEmpty>No team members found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[200px]">
                      {teamMembers.map((member) => (
                        <CommandItem
                          key={member.id}
                          value={member.id}
                          onSelect={() => handleAllocationChange(member.id, 0)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  data.teamMembers?.includes(member.id)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span>{member.name}</span>
                            </div>
                            {member.dailyRate && (
                              <span className="text-muted-foreground">
                                ${member.dailyRate}/day
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedMembers.length > 0 && (
            <div className="space-y-4">
              {selectedMembers.map((member) => {
                const allocation = data.memberAllocations?.find(
                  a => a.memberId === member.id
                )?.timePercentage || 0;

                // Calculate allocated days based on feature duration
                const allocatedDays = data.duration 
                  ? Math.round((allocation / 100) * data.duration * 10) / 10
                  : 0;

                return (
                  <div key={member.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {member.name}
                        {member.dailyRate && ` • $${member.dailyRate}/day`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {allocation}% allocation
                        {allocatedDays > 0 && ` (${allocatedDays} days)`}
                      </span>
                    </div>
                    <Slider
                      value={[allocation]}
                      onValueChange={([value]) => handleAllocationChange(member.id, value)}
                      min={0}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                  </div>
                );
              })}

              <CostSummary 
                costs={costs}
                selectedMembers={selectedMembers}
                duration={data.duration}
              />
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Top}
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