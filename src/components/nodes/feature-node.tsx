"use client";

import { Handle, Position, type NodeProps, useEdges } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useState, useMemo, memo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RFFeatureNodeData } from '@/services/graph/feature/feature.types';
import { useFeatureNode } from '@/hooks/useFeatureNode';
import { toast } from "sonner";
import { Users2, User, Clock, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Utility function to format numbers in a user-friendly way
const formatNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null) return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  // For whole numbers, don't show decimal places
  if (Number.isInteger(num)) return num.toString();
  
  // For numbers with decimal places, limit to 1 decimal place
  return num.toFixed(1);
};

// Type for managing selected members in the dialog
interface MemberSelection {
  memberId: string;
  hours: number;
}

// Add interfaces for roster and team members
interface TeamMember {
  memberId: string;
  name?: string;
  allocation?: number;
  role?: string;
}

// Create a simple Progress component
const Progress = ({ value = 0, className = "" }) => {
  return (
    <div className={cn("w-full bg-muted rounded-full overflow-hidden", className)}>
      <div 
        className="bg-primary h-full transition-all duration-300 ease-in-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
const FeatureNode = memo(function FeatureNode({ id, data, selected }: NodeProps) {
  const edges = useEdges();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<MemberSelection[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);
  
  // Use our custom hook for feature node logic
  const feature = useFeatureNode(id, data as RFFeatureNodeData);
  
  // Update the handleAllocationSubmit function to include member names
  const handleAllocationSubmit = () => {
    if (!selectedTeamId) return;
    
    // Get the selected team
    const selectedTeam = feature.connectedTeams.find(t => t.teamId === selectedTeamId);
    if (!selectedTeam) return;
    
    // Get the member data for each selected member
    const membersWithData = selectedMembers.map(member => {
      // Find the member in the team's available bandwidth
      const memberInfo = selectedTeam.availableBandwidth.find(m => m.memberId === member.memberId);
      
      return {
        ...member,
        name: memberInfo?.name || formatMemberName(member.memberId, memberInfo)
      };
    });
    
    console.log('Allocating members with data:', membersWithData);
    
    // Call the requestTeamAllocation function with the full member objects
    feature.requestTeamAllocation(
      selectedTeamId,
      totalHours,
      membersWithData
    );
    
    // Reset state
    setSelectedTeamId(null);
    setSelectedMembers([]);
    setTotalHours(0);
  };

  // Improve the formatMemberName function to better handle member data
  const formatMemberName = (memberId: string, memberData?: any): string => {
    // First try to get the name from the member data
    if (memberData) {
      // Check for name or title in the member data
      if (typeof memberData === 'string') {
        return memberData;
      }
      
      if (typeof memberData === 'object') {
        // Try to get name or title from the object
        if (memberData.name) return memberData.name;
        if (memberData.title) return memberData.title;
      }
    }
    
    // If no name is provided, try to extract a readable name from the ID
    if (typeof memberId === 'string' && memberId.includes('-')) {
      // Get the first segment of the UUID which is often more readable
      return `Team Member ${memberId.split('-')[0].substring(0, 4)}`;
    }
    
    // Fallback
    return 'Team Member';
  };

  // Pre-calculate allocation percentages for all members to avoid conditional hooks
  const memberAllocations = useMemo(() => {
    const allocations = new Map();
    
    // Debug log to see what we're working with
    console.log('🔍 Calculating member allocations with:', {
      connectedTeams: feature.connectedTeams,
      teamAllocations: feature.teamAllocations,
      processedTeamAllocations: feature.processedTeamAllocations,
    });
    
    // Process each team allocation
    feature.processedTeamAllocations.forEach(allocation => {
      // Process each member in the allocation
      allocation.allocatedMembers.forEach(member => {
        // Log the full member object to see what properties are available
        console.log('Member allocation data:', member);
        
        // Use the member's name if available, otherwise format the ID
        const memberName = member.name || formatMemberName(member.memberId);
        
        // Calculate percentage based on hours, duration and hours per day
        const duration = Number(data.duration) || 1;
        const hoursPerDay = 8; // Default working hours per day
        const memberHours = typeof member.hours === 'number' ? member.hours : 0;
        const percentage = (memberHours / (duration * hoursPerDay)) * 100;
        
        // Add or update the allocation for this member
        if (allocations.has(member.memberId)) {
          const current = allocations.get(member.memberId);
          const currentHours = typeof current.hours === 'number' ? current.hours : 0;
          allocations.set(member.memberId, {
            ...current,
            hours: currentHours + memberHours,
            percentage: percentage,
            name: memberName // Ensure we store the name
          });
        } else {
          allocations.set(member.memberId, {
            memberId: member.memberId,
            hours: memberHours,
            percentage: percentage,
            name: memberName // Store the name
          });
        }
      });
    });
    
    return allocations;
  }, [feature.connectedTeams, feature.teamAllocations, feature.processedTeamAllocations, data.duration]);

  // Update the renderTeamMembers function to better handle member data
  const renderTeamMembers = () => {
    // Find the selected team
    const selectedTeam = feature.connectedTeams.find(t => t.teamId === selectedTeamId);
    
    // If we have the team's roster, display it
    if (selectedTeam) {
      // Try to get the team node to access its roster
      const teamNode = selectedTeam.availableBandwidth || [];
      
      if (teamNode.length === 0) {
        return (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No team members available in roster
          </div>
        );
      }
      
      return (
        <div className="space-y-1 max-h-60 overflow-y-auto p-2 border rounded-md">
          {teamNode.map((member) => {
            // Check if this member is already selected
            const isSelected = selectedMembers.some(m => m.memberId === member.memberId);
            const memberHours = selectedMembers.find(m => m.memberId === member.memberId)?.hours || 0;
            
            // Get a more user-friendly name using our improved function
            const memberName = formatMemberName(member.memberId, member);
            
            return (
              <div key={member.memberId} className={cn(
                "flex items-center space-x-2 p-2 rounded-md transition-colors",
                isSelected ? "bg-muted" : "hover:bg-muted/50"
              )}>
                <Checkbox 
                  id={`member-${member.memberId}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Add to selected members
                      setSelectedMembers(prev => [
                        ...prev, 
                        { memberId: member.memberId, hours: 0 }
                      ]);
                    } else {
                      // Remove from selected members
                      setSelectedMembers(prev => 
                        prev.filter(m => m.memberId !== member.memberId)
                      );
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <Label 
                    htmlFor={`member-${member.memberId}`}
                    className="flex-1 cursor-pointer text-sm truncate"
                  >
                    {member.name || memberName}
                  </Label>
                  {isSelected && (
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(memberHours)} hours allocated
                    </p>
                  )}
                </div>
                
                {isSelected && (
                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        const hours = Math.max(0, memberHours - 1);
                        setSelectedMembers(prev => 
                          prev.map(m => 
                            m.memberId === member.memberId 
                              ? { ...m, hours } 
                              : m
                          )
                        );
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      className="w-16 h-7 text-xs"
                      value={memberHours}
                      onChange={(e) => {
                        const hours = Number(e.target.value);
                        setSelectedMembers(prev => 
                          prev.map(m => 
                            m.memberId === member.memberId 
                              ? { ...m, hours } 
                              : m
                          )
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        const hours = memberHours + 1;
                        setSelectedMembers(prev => 
                          prev.map(m => 
                            m.memberId === member.memberId 
                              ? { ...m, hours } 
                              : m
                          )
                        );
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    return (
      <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
        Loading team members...
      </div>
    );
  };

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${feature.getStatusColor(feature.status)}`}
              onClick={feature.cycleStatus}
            >
              {feature.status}
            </Badge>
            <input
              value={feature.title}
              onChange={(e) => feature.handleTitleChange(e.target.value)}
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Feature Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <button
            onClick={() => feature.refreshData()}
            className="p-1 rounded-sm hover:bg-accent hover:text-accent-foreground"
            title="Refresh data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>
          <NodeHeaderMenuAction label="Feature node menu">
            <DropdownMenuItem 
              onSelect={() => {
                // Handle delete through a different approach
                if (confirm('Are you sure you want to delete this feature?')) {
                  // We could use an API call here or dispatch an event
                  console.log('Delete feature:', id);
                }
              }} 
              className="cursor-pointer"
            >
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        <Textarea
          value={feature.description}
          onChange={(e) => feature.handleDescriptionChange(e.target.value)}
          placeholder="Describe this feature..."
          className="min-h-[100px] w-full resize-y bg-transparent"
        />

        <div className="space-y-2">
          <Label>Build Type</Label>
          {!feature.isLoading && (
            <RadioGroup
              key={`buildtype-${feature.buildType || 'internal'}`}
              value={feature.buildType || 'internal'}
              onValueChange={feature.handleBuildTypeChange}
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
          )}
          {feature.isLoading && (
            <div className="text-sm text-muted-foreground">Loading...</div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{feature.duration.config.label}</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={feature.duration.value || ''}
                onChange={(e) => feature.duration.handleDurationChange(e.target.value)}
                onKeyDown={feature.duration.handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {feature.duration.displayValue}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {feature.duration.config.tip} Max {feature.duration.formatDuration(feature.duration.config.maxDays)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Team Allocations</Label>
          
          {feature.connectedTeams.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          ) : (
            <div className="space-y-4">
              {feature.connectedTeams.map(team => (
                <div key={team.teamId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{team.name || formatMemberName(team.teamId, team)}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedTeamId(team.teamId)}
                    >
                      Allocate
                    </Button>
                  </div>

                  {/* Member Allocation Controls */}
                  <div className="space-y-4">
                    {team.availableBandwidth.map(member => {
                      // Use pre-calculated values from the memberAllocations map
                      const allocation = memberAllocations.get(member.memberId) || {
                        percentage: 0,
                        hours: 0,
                        name: member.name || formatMemberName(member.memberId, member)
                      };
                      
                      // Ensure we have a valid percentage value for the slider
                      const sliderValue = isNaN(allocation.percentage) ? 0 : allocation.percentage;
                      
                      return (
                        <div key={member.memberId} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{allocation.name || member.name || formatMemberName(member.memberId, member)}</span>
                            <span className="text-muted-foreground">
                              {formatNumber(allocation.hours)}h allocated
                            </span>
                          </div>
                          <Slider
                            value={[sliderValue]}
                            onValueChange={([value]) => {
                              // Only update local state for immediate UI feedback
                              feature.handleAllocationChangeLocal(member.memberId, value);
                            }}
                            onValueCommit={([value]) => {
                              // Save to backend only when the user finishes dragging
                              feature.handleAllocationCommit(member.memberId, value);
                            }}
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
          <Dialog key={`dialog-${selectedTeamId}`} open={!!selectedTeamId} onOpenChange={(open) => !open && setSelectedTeamId(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Allocate Team Members</DialogTitle>
                <DialogDescription>
                  Allocate members from {
                    (() => {
                      const team = feature.connectedTeams.find(t => t.teamId === selectedTeamId);
                      return team ? (team.name || formatMemberName(team.teamId, team)) : 'team';
                    })()
                  } to this feature.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Total Hours Input */}
                <div className="space-y-2">
                  <Label htmlFor="hours" className="flex items-center justify-between">
                    <span>Total Hours Requested</span>
                    <span className="text-xs text-muted-foreground">
                      Feature Duration: {(data as RFFeatureNodeData).duration || 0} days
                    </span>
                  </Label>
                  <Input
                    id="hours"
                    type="number"
                    min="0"
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                  />
                </div>
                
                {/* Team Members Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Team Members</Label>
                    {selectedMembers.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selectedMembers.length} selected
                      </Badge>
                    )}
                  </div>
                  
                  {renderTeamMembers()}
                </div>
                
                {/* Summary */}
                {selectedMembers.length > 0 && (
                  <div className="space-y-2 border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Allocated</span>
                      <span className="text-sm">
                        {formatNumber(selectedMembers.reduce((sum, m) => sum + m.hours, 0))} / {formatNumber(totalHours)} hours
                      </span>
                    </div>
                    <Progress 
                      value={(selectedMembers.reduce((sum, m) => sum + m.hours, 0) / totalHours) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTeamId(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAllocationSubmit}
                  disabled={totalHours <= 0}
                >
                  Save Allocation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Improve the display of connected teams and their members */}
        {feature.connectedTeams && feature.connectedTeams.length > 0 && (
          <div className="mt-4 border-t pt-2">
            <h3 className="text-sm font-medium mb-2 flex items-center justify-between">
              <span>Team Allocations</span>
              <Badge variant="outline" className="text-xs font-normal">
                {feature.connectedTeams.length} team{feature.connectedTeams.length !== 1 ? 's' : ''}
              </Badge>
            </h3>
            
            {feature.connectedTeams.map(team => {
              // Find the team allocation for this team
              const teamAllocation = feature.processedTeamAllocations?.find(a => a.teamId === team.teamId);
              const allocatedMembers = teamAllocation?.allocatedMembers || [];
              
              return (
                <div key={team.teamId} className="mb-3 bg-muted/30 p-2 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Users2 className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-sm">{team.name || formatMemberName(team.teamId, team)}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {formatNumber(teamAllocation?.requestedHours)}h
                    </Badge>
                  </div>
                  
                  {/* Allocated Members */}
                  {allocatedMembers.length > 0 ? (
                    <div className="space-y-1 mt-2">
                      {allocatedMembers.map(member => {
                        // Try to find the member in the team's available bandwidth to get the name
                        const memberInfo = team.availableBandwidth.find(m => m.memberId === member.memberId);
                        
                        return (
                          <div key={member.memberId} className="flex items-center justify-between bg-background/50 px-2 py-1 rounded text-xs">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{member.name || memberInfo?.name || formatMemberName(member.memberId, memberInfo)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{formatNumber(member.hours)}h</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1 italic">
                      No members allocated
                    </div>
                  )}
                  
                  {/* Team Member Allocation Button */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs mt-2 h-7"
                    onClick={() => {
                      // Open dialog to allocate team members
                      setSelectedTeamId(team.teamId);
                      setTotalHours(teamAllocation?.requestedHours || 0);
                      
                      // Pre-select already allocated members
                      if (allocatedMembers.length > 0) {
                        setSelectedMembers(
                          allocatedMembers.map(member => ({
                            memberId: member.memberId,
                            hours: member.hours
                          }))
                        );
                      } else {
                        // Reset selected members
                        setSelectedMembers([]);
                      }
                    }}
                  >
                    {allocatedMembers.length > 0 ? 'Edit Allocation' : 'Allocate Members'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add a button to open the allocation dialog */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs mt-2 h-7"
          onClick={() => {
            // Find a connected team if any
            if (feature.connectedTeams && feature.connectedTeams.length > 0) {
              // Select the first team by default
              setSelectedTeamId(feature.connectedTeams[0].teamId);
              setTotalHours(feature.connectedTeams[0].requestedHours || 0);
              // Reset selected members
              setSelectedMembers([]);
            } else {
              toast.error("No teams connected. Connect a team to this feature first.");
            }
          }}
        >
          Allocate Team Members
        </Button>
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
});

// Export the memoized component
export { FeatureNode };