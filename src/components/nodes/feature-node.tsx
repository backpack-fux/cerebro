"use client";

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useState, useMemo, useRef, useEffect } from "react";
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
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFFeatureNodeData, 
  BuildType, 
  TeamAllocation
} from '@/services/graph/feature/feature.types';

// Add this type for managing selected members in the dialog
interface MemberSelection {
  memberId: string;
  hours: number;
}

export function FeatureNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  // Cast data to the correct type
  const featureData = data as RFFeatureNodeData;
  
  // Refs for debounce timers
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    connectedTeams,
    requestTeamAllocation,
    costs,
    CostSummary
  } = useTeamAllocation(id, featureData);

  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, featureData, updateNodeData, {
    canBeActive: true, // Features can be "active" after completion
    defaultStatus: 'planning'
  });
  
  // Function to save data to backend
  const saveToBackend = useCallback(async (updatedData: Partial<RFFeatureNodeData>) => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await GraphApiClient.updateNode('feature' as NodeType, id, updatedData);
        console.log(`Updated feature ${id}`);
      } catch (error) {
        console.error(`Failed to update feature ${id}:`, error);
        toast.error("Your changes couldn't be saved to the database.");
      }
      saveDebounceRef.current = null;
    }, 1000);
  }, [id]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    updateNodeData(id, { ...featureData, title: newTitle });
    saveToBackend({ title: newTitle });
  }, [id, featureData, updateNodeData, saveToBackend]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    updateNodeData(id, { ...featureData, description: newDescription });
    saveToBackend({ description: newDescription });
  }, [id, featureData, updateNodeData, saveToBackend]);

  const handleBuildTypeChange = useCallback((value: BuildType) => {
    updateNodeData(id, { ...featureData, buildType: value });
    saveToBackend({ buildType: value });
  }, [id, featureData, updateNodeData, saveToBackend]);

  const duration = useDurationInput(id, featureData, updateNodeData, {
    maxDays: 72,
    label: "Time to Build",
    fieldName: "duration",
    tip: 'Use "w" for weeks (e.g. "2w" = 2 weeks) or ↑↓ keys. Hold Shift for week increments.'
  });
  
  // Override the duration change handler to save to backend
  useEffect(() => {
    if (featureData.duration !== undefined) {
      saveToBackend({ duration: featureData.duration });
    }
  }, [featureData.duration, saveToBackend]);

  const handleDelete = useCallback(() => {
    // First delete the node from the database
    GraphApiClient.deleteNode('feature' as NodeType, id)
      .then(() => {
        console.log(`Successfully deleted feature node ${id}`);
        // Then remove it from the UI
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete associated edges
        setEdges((edges) => {
          const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
          connectedEdges.forEach((edge) => {
            GraphApiClient.deleteEdge('feature' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
          });
          return edges.filter((edge) => edge.source !== id && edge.target !== id);
        });
      })
      .catch((error) => {
        console.error(`Failed to delete feature node ${id}:`, error);
        toast.error("The feature couldn't be deleted from the database.");
      });
  }, [id, setNodes, setEdges]);

  // Calculate total allocated hours and costs
  const teamAllocations = useMemo(() => {
    return connectedTeams.map(team => {
      const allocation = featureData.teamAllocations?.find(a => a.teamId === team.teamId);
      return {
        ...team,
        requestedHours: allocation?.requestedHours || 0,
        allocatedMembers: allocation?.allocatedMembers || []
      };
    });
  }, [connectedTeams, featureData.teamAllocations]);

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
    
    // Update the team allocations in the node data
    const updatedTeamAllocations = [...(featureData.teamAllocations || [])];
    const existingAllocationIndex = updatedTeamAllocations.findIndex(a => a.teamId === selectedTeamId);
    
    if (existingAllocationIndex >= 0) {
      // Update existing allocation
      updatedTeamAllocations[existingAllocationIndex] = {
        ...updatedTeamAllocations[existingAllocationIndex],
        requestedHours: totalHours,
        allocatedMembers: selectedMembers.map(m => ({ memberId: m.memberId, hours: totalHours / selectedMembers.length }))
      };
    } else {
      // Create new allocation
      updatedTeamAllocations.push({
        teamId: selectedTeamId,
        requestedHours: totalHours,
        allocatedMembers: selectedMembers.map(m => ({ memberId: m.memberId, hours: totalHours / selectedMembers.length }))
      });
    }
    
    // Update the node data
    updateNodeData(id, { ...featureData, teamAllocations: updatedTeamAllocations });
    
    // Save to backend
    saveToBackend({ teamAllocations: updatedTeamAllocations });
    
    // Reset state
    setSelectedTeamId(null);
    setSelectedMembers([]);
    setTotalHours(0);
  }, [selectedTeamId, totalHours, selectedMembers, requestTeamAllocation, featureData, id, updateNodeData, saveToBackend]);

  // Handle allocation changes
  const handleAllocationChange = useCallback((memberId: string, percentage: number) => {
    const teamId = connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    )?.teamId;

    if (!teamId) return;

    // Calculate hours based on percentage
    const hoursRequested = (percentage / 100) * 8 * (featureData.duration || 1);
    
    // Update the team allocations in the node data
    const updatedTeamAllocations: TeamAllocation[] = [...(featureData.teamAllocations || [])];
    const existingAllocationIndex = updatedTeamAllocations.findIndex(a => a.teamId === teamId);
    
    if (existingAllocationIndex >= 0) {
      // Update existing allocation
      const existingAllocation = updatedTeamAllocations[existingAllocationIndex];
      const existingMemberIndex = existingAllocation.allocatedMembers.findIndex(m => m.memberId === memberId);
      
      if (existingMemberIndex >= 0) {
        // Update existing member allocation
        existingAllocation.allocatedMembers[existingMemberIndex].hours = hoursRequested;
      } else {
        // Add new member allocation
        existingAllocation.allocatedMembers.push({ memberId, hours: hoursRequested });
      }
      
      // Update total requested hours
      existingAllocation.requestedHours = existingAllocation.allocatedMembers.reduce(
        (total, member) => total + member.hours, 0
      );
      
      updatedTeamAllocations[existingAllocationIndex] = existingAllocation;
    } else {
      // Create new allocation
      updatedTeamAllocations.push({
        teamId,
        requestedHours: hoursRequested,
        allocatedMembers: [{ memberId, hours: hoursRequested }]
      });
    }
    
    // Update the node data
    updateNodeData(id, { ...featureData, teamAllocations: updatedTeamAllocations });
    
    // Save to backend
    saveToBackend({ teamAllocations: updatedTeamAllocations });
    
    // Also call the hook function for UI updates
    requestTeamAllocation(teamId, hoursRequested, [memberId]);
  }, [connectedTeams, featureData, id, updateNodeData, saveToBackend, requestTeamAllocation]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

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
              value={featureData.title}
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
          value={featureData.description || ''}
          onChange={handleDescriptionChange}
          placeholder="Describe this feature..."
          className="min-h-[100px] w-full resize-y bg-transparent"
        />

        <div className="space-y-2">
          <Label>Build Type</Label>
          <RadioGroup
            value={featureData.buildType}
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
                      const allocation = featureData.teamAllocations
                        ?.find(a => a.teamId === team.teamId)
                        ?.allocatedMembers
                        .find(m => m.memberId === member.memberId);
                      
                      const percentage = allocation 
                        ? (allocation.hours / 8 / (featureData.duration || 1)) * 100 
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
          <CostSummary costs={costs} duration={featureData.duration} />
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