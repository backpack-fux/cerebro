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
import { useCallback, useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export type BuildType = 'internal' | 'external';
export type TimeUnit = 'days' | 'weeks';

// Add this type to define member allocation
interface MemberAllocation {
  memberId: string;
  timePercentage: number;
}

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
  teamAllocations?: {
    teamId: string;
    requestedHours: number;
    allocatedMembers: { memberId: string; hours: number }[];
  }[];
  availableBandwidth: { memberId: string; dailyRate: number }[];
}>;

// Add this type for managing selected members in the dialog
interface MemberSelection {
  memberId: string;
  hours: number;
}

export function FeatureNode({ id, data, selected }: NodeProps<FeatureNodeData>) {
  const { updateNodeData, setNodes } = useReactFlow();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  const {
    connectedTeams,
    requestTeamAllocation,
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

  // Calculate total allocated hours and costs
  const teamAllocations = useMemo(() => {
    return connectedTeams.map(team => {
      const allocation = data.teamAllocations?.find(a => a.teamId === team.teamId);
      return {
        ...team,
        requestedHours: allocation?.requestedHours || 0,
        allocatedMembers: allocation?.allocatedMembers || []
      };
    });
  }, [connectedTeams, data.teamAllocations]);

  // Add state for managing member selection
  const [selectedMembers, setSelectedMembers] = useState<MemberSelection[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);

  // Add handler for the allocation dialog
  const handleAllocationSubmit = useCallback(() => {
    if (!selectedTeamId) return;
    
    requestTeamAllocation(
      selectedTeamId,
      totalHours,
      selectedMembers.map(m => m.memberId)
    );
    setSelectedTeamId(null);
    setSelectedMembers([]);
    setTotalHours(0);
  }, [selectedTeamId, totalHours, selectedMembers, requestTeamAllocation]);

  // Handle allocation changes
  const handleAllocationChange = useCallback((memberId: string, percentage: number) => {
    const teamId = connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    )?.teamId;

    if (!teamId) return;

    // Update the allocation
    const hoursRequested = (percentage / 100) * 8 * (data.duration || 1); // Convert % to hours
    requestTeamAllocation(teamId, hoursRequested, [memberId]);
  }, [connectedTeams, data.duration, requestTeamAllocation]);

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
          <Label>Team Allocations</Label>
          
          {connectedTeams.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          ) : (
            <div className="space-y-4">
              {connectedTeams.map(team => (
                <div key={team.teamId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team.title}</span>
                  </div>

                  {/* Member Allocation Controls */}
                  <div className="space-y-4">
                    {team.availableBandwidth.map(member => {
                      const allocation = data.teamAllocations
                        ?.find(a => a.teamId === team.teamId)
                        ?.allocatedMembers
                        .find(m => m.memberId === member.memberId);
                      
                      const percentage = allocation 
                        ? (allocation.hours / 8 / (data.duration || 1)) * 100 
                        : 0;

                      return (
                        <div key={member.memberId} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{member.name}</span>
                            <span className="text-muted-foreground">
                              {percentage.toFixed(0)}% ({member.availableHours}h available)
                            </span>
                          </div>
                          <Slider
                            value={[percentage]}
                            onValueChange={([value]) => handleAllocationChange(member.memberId, value)}
                            max={100}
                            step={1}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member Allocation Dialog */}
        {selectedTeamId && (
          <Dialog open={true} onOpenChange={() => setSelectedTeamId(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Allocate Team Members</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Total Hours Input */}
                <div className="space-y-2">
                  <Label>Total Hours Needed</Label>
                  <Input
                    type="number"
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    min={0}
                    step={1}
                  />
                </div>

                {/* Member Selection */}
                <div className="space-y-2">
                  <Label>Available Team Members</Label>
                  <div className="space-y-2">
                    {teamAllocations
                      .find(t => t.teamId === selectedTeamId)
                      ?.availableBandwidth.map(member => (
                        <div key={member.memberId} className="flex items-center justify-between space-x-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedMembers.some(m => m.memberId === member.memberId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedMembers([...selectedMembers, { 
                                    memberId: member.memberId,
                                    hours: 0
                                  }]);
                                } else {
                                  setSelectedMembers(selectedMembers.filter(
                                    m => m.memberId !== member.memberId
                                  ));
                                }
                              }}
                            />
                            <span>{member.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {member.availableHours}h available
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={handleAllocationSubmit}
                  disabled={totalHours <= 0 || selectedMembers.length === 0}
                >
                  Allocate Members
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Cost Summary */}
        {costs && costs.allocations.length > 0 && (
          <CostSummary costs={costs} duration={data.duration} />
        )}
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