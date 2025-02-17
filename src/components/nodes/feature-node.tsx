"use client";

import { Handle, Position, type NodeProps, type Node, useNodeConnections, useReactFlow, type Edge } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useState, useMemo, useEffect } from "react";
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

export type BuildType = 'internal' | 'external';
export type TimeUnit = 'days' | 'weeks';

const MAX_DAYS = 72;

// Helper function to format duration display
const formatDuration = (days: number) => {
  const weeks = Math.floor(days / 6);
  const remainingDays = days % 6;
  
  if (weeks === 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (remainingDays === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  return `${weeks} week${weeks !== 1 ? 's' : ''} ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
};

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

// Define a proper type for team members
interface TeamMember {
  id: string;
  name: string;
  dailyRate?: number;
}

export function FeatureNode({ id, data, selected }: NodeProps<FeatureNodeData>) {
  const { updateNodeData, setNodes, getNodes, getEdges, setEdges } = useReactFlow();
  const [open, setOpen] = useState(false);
  
  // Get node connections
  const connections = useNodeConnections({
    id: id,
  });

  // Watch for connection changes and update team members
  useEffect(() => {
    const connectedTeamMembers = connections
      .filter(connection => {
        // Check both source and target since the connection could be in either direction
        const connectedNode = getNodes().find(node => 
          node.id === connection.source || node.id === connection.target
        );
        // Make sure we're looking at the other node, not the feature node itself
        const isTeamMember = connectedNode?.type === 'teamMember' && connectedNode.id !== id;
        return isTeamMember;
      })
      .map(connection => 
        // Get the ID of the team member node (could be source or target)
        connection.source === id ? connection.target : connection.source
      );

    // Get current team members
    const currentMembers = data.teamMembers || [];
    
    // Find new members to add
    const newMembers = connectedTeamMembers.filter(
      memberId => !currentMembers.includes(memberId)
    );

    // If we have new members, update the node data
    if (newMembers.length > 0) {
      const updatedMembers = [...currentMembers, ...newMembers];
      
      // Initialize allocations for new members with 0%
      const currentAllocations = data.memberAllocations || [];
      const newAllocations = newMembers.map(memberId => ({
        memberId,
        timePercentage: 0
      }));

      updateNodeData(id, {
        ...data,
        teamMembers: updatedMembers,
        memberAllocations: [...currentAllocations, ...newAllocations]
      });
    }
  }, [connections, data, id, updateNodeData, getNodes]);

  // Get all team member nodes with proper typing
  const teamMembers = useMemo<TeamMember[]>(() => {
    return getNodes()
      .filter(node => node.type === 'teamMember')
      .map(node => ({
        id: node.id,
        name: node.data.title as string,
        dailyRate: node.data.dailyRate as number | undefined,
      }));
  }, [getNodes]);

  const selectedMembers = useMemo(() => {
    return teamMembers.filter(member => data.teamMembers?.includes(member.id));
  }, [teamMembers, data.teamMembers]);

  const handleTeamMemberToggle = useCallback((memberId: string) => {
    const currentMembers = data.teamMembers || [];
    const isAdding = !currentMembers.includes(memberId);
    const newMembers = isAdding
      ? [...currentMembers, memberId]
      : currentMembers.filter(id => id !== memberId);
    
    // Update node data with new members
    updateNodeData(id, { ...data, teamMembers: newMembers });

    // If we're adding a new member, create an edge if it doesn't exist
    if (isAdding) {
      const existingEdges = getEdges();
      const hasConnection = existingEdges.some(
        edge => 
          (edge.source === memberId && edge.target === id) ||
          (edge.source === id && edge.target === memberId)
      );

      if (!hasConnection) {
        // Create new edge from team member to feature
        const newEdge: Edge = {
          id: `${memberId}-${id}`,
          source: memberId,
          target: id,
          type: 'default',
        };

        setEdges(edges => [...edges, newEdge]);
      }
    }
  }, [id, data, updateNodeData, getEdges, setEdges]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, description: e.target.value });
  }, [id, data, updateNodeData]);

  const handleBuildTypeChange = useCallback((value: BuildType) => {
    updateNodeData(id, { ...data, buildType: value });
  }, [id, data, updateNodeData]);

  const handleDurationChange = useCallback((value: string) => {
    const unit = value.endsWith('w') ? 'weeks' : 'days';
    const duration = parseInt(value);
    
    if (!isNaN(duration)) {
      // Convert to days if weeks were entered
      const days = unit === 'weeks' ? duration * 6 : duration;
      
      // Enforce maximum duration
      if (days <= MAX_DAYS) {
        updateNodeData(id, { 
          ...data, 
          duration: days,
        });
      }
    }
  }, [id, data, updateNodeData]);

  const handleDurationKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentDays = data.duration || 0;
    let newDays = currentDays;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        // Increment by 6 days (1 week) if shift is pressed, otherwise 1 day
        newDays = Math.min(currentDays + (e.shiftKey ? 6 : 1), MAX_DAYS);
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Decrement by 6 days (1 week) if shift is pressed, otherwise 1 day
        newDays = Math.max(currentDays - (e.shiftKey ? 6 : 1), 0);
        break;
      default:
        return;
    }

    if (newDays !== currentDays) {
      updateNodeData(id, { ...data, duration: newDays });
    }
  }, [data, updateNodeData, id]);

  const handleAllocationChange = useCallback((memberId: string, timePercentage: number) => {
    const currentAllocations = data.memberAllocations || [];
    const newAllocations = currentAllocations.some(a => a.memberId === memberId)
      ? currentAllocations.map(a => 
          a.memberId === memberId 
            ? { ...a, timePercentage } 
            : a
        )
      : [...currentAllocations, { memberId, timePercentage }];

    updateNodeData(id, { ...data, memberAllocations: newAllocations });
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
            placeholder="Feature Title"
          />
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
                          onSelect={() => handleTeamMemberToggle(member.id)}
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
            <div className="space-y-4 mt-4">
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
                    {allocation > 0 && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          Allocated time: {allocatedDays} days
                          {member.dailyRate && ` • $${(member.dailyRate * allocatedDays).toFixed(2)} total`}
                        </p>
                        {member.dailyRate && (
                          <p>Daily cost: ${(member.dailyRate * (allocation / 100)).toFixed(2)}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="border-t pt-2">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Total allocation cost: ${selectedMembers.reduce((sum, member) => {
                      const allocation = data.memberAllocations?.find(
                        a => a.memberId === member.id
                      )?.timePercentage || 0;
                      const allocatedDays = data.duration 
                        ? (allocation / 100) * data.duration
                        : 0;
                      return sum + (member.dailyRate || 0) * allocatedDays;
                    }, 0).toFixed(2)}
                  </p>
                  <p>
                    Total daily cost: ${selectedMembers.reduce((sum, member) => {
                      const allocation = data.memberAllocations?.find(
                        a => a.memberId === member.id
                      )?.timePercentage || 0;
                      return sum + (member.dailyRate || 0) * (allocation / 100);
                    }, 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Estimated Cost</Label>
          {selectedMembers.length > 0 && data.duration && (
            <div className="space-y-4 mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Cost Summary</h4>
                
                {/* Resource Breakdown */}
                <div className="space-y-2">
                  {selectedMembers.map((member) => {
                    const allocation = data.memberAllocations?.find(
                      a => a.memberId === member.id
                    )?.timePercentage || 0;
                    const allocatedDays = Math.round((allocation / 100) * data.duration! * 10) / 10;
                    const memberCost = member.dailyRate ? member.dailyRate * allocatedDays : 0;

                    if (allocation > 0) {
                      return (
                        <div key={member.id} className="flex justify-between items-baseline text-sm">
                          <div className="space-x-2">
                            <span className="font-medium">{member.name}</span>
                            <span className="text-muted-foreground">
                              {allocatedDays} days ({allocation}%)
                            </span>
                          </div>
                          {memberCost > 0 && (
                            <span className="font-mono text-muted-foreground">
                              ${memberCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Totals */}
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Total Resource Cost</span>
                    <span className="font-mono">
                      ${selectedMembers.reduce((sum, member) => {
                        const allocation = data.memberAllocations?.find(
                          a => a.memberId === member.id
                        )?.timePercentage || 0;
                        const allocatedDays = data.duration 
                          ? (allocation / 100) * data.duration
                          : 0;
                        return sum + (member.dailyRate || 0) * allocatedDays;
                      }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
                    <span>Daily Rate</span>
                    <span className="font-mono">
                      ${selectedMembers.reduce((sum, member) => {
                        const allocation = data.memberAllocations?.find(
                          a => a.memberId === member.id
                        )?.timePercentage || 0;
                        return sum + (member.dailyRate || 0) * (allocation / 100);
                      }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Total Duration</span>
                    <span className="font-mono">{data.duration} days</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Build Time</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={data.duration ? `${data.duration}` : ''}
                onChange={(e) => handleDurationChange(e.target.value)}
                onKeyDown={handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {data.duration ? formatDuration(data.duration) : 'days'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Use &quot;w&quot; for weeks (e.g. &quot;2w&quot; = 2 weeks) or ↑↓ keys. Hold Shift for week increments. Max {formatDuration(MAX_DAYS)}
            </p>
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
