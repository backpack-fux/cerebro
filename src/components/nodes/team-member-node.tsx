"use client";

import { Handle, Position, type NodeProps, Node } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { useReactFlow, useNodeConnections } from "@xyflow/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useValidation } from '@/contexts/validation-context';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { toast } from "sonner";
import { 
  RFTeamMemberNodeData, 
  TeamMemberSummary, 
  TIMEZONES,
  DEFAULT_START_DATE,
  EARLIEST_START_DATE
} from '@/services/graph/team-member/team-member.types';
import { BASE_ROLES } from '@/services/graph/shared/shared.types';
import { Slider } from "@/components/ui/slider";
import { RosterMember, RFTeamNodeData } from '@/services/graph/team/team.types';

// Type guard for team nodes
function isTeamNode(node: Node | null | undefined): node is Node<RFTeamNodeData> {
  return Boolean(
    node?.type === 'team' && 
    node?.data
  );
}

export function TeamMemberNode({ 
  id, 
  data, 
  selected 
}: NodeProps) {
  const { updateNodeData, setNodes, getNodes, getNode } = useReactFlow();
  const { addError, clearErrors, getErrors } = useValidation();
  const connections = useNodeConnections({ id });

  // Cast data to the correct type
  const memberData = data as RFTeamMemberNodeData;
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const bioDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const hoursDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const daysDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const startDateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rolesDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const timezoneDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const allocationDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to save data to backend
  const saveToBackend = useCallback(async (updatedData: Partial<RFTeamMemberNodeData>) => {
    try {
      await GraphApiClient.updateNode('teamMember' as NodeType, id, updatedData);
      console.log(`Updated team member ${id}:`, updatedData);
    } catch (error) {
      console.error(`Failed to update team member ${id}:`, error);
      toast.error(`Failed to save changes`, {
        description: `${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }, [id]);

  // Initialize with defaults if values are undefined
  useEffect(() => {
    if (memberData.hoursPerDay === undefined || 
        memberData.daysPerWeek === undefined || 
        !memberData.startDate) {
      updateNodeData(id, {
        ...memberData,
        hoursPerDay: memberData.hoursPerDay ?? 8,
        daysPerWeek: memberData.daysPerWeek ?? 5,
        weeklyCapacity: (memberData.hoursPerDay ?? 8) * (memberData.daysPerWeek ?? 5),
        startDate: memberData.startDate ?? DEFAULT_START_DATE,
        // Ensure name is set if it's not already
        name: memberData.name ?? memberData.title ?? 'Untitled Team Member',
        // Ensure description is set if it's not already
        description: memberData.description ?? memberData.bio ?? '',
      });
    }
  }, [id, memberData, updateNodeData]);

  // Calculate weekly capacity
  const updateWeeklyCapacity = useCallback((hoursPerDay: number, daysPerWeek: number) => {
    const updatedData: Partial<RFTeamMemberNodeData> = {
      hoursPerDay,
      daysPerWeek,
      weeklyCapacity: hoursPerDay * daysPerWeek
    };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (hoursDebounceRef.current) {
      clearTimeout(hoursDebounceRef.current);
    }
    if (daysDebounceRef.current) {
      clearTimeout(daysDebounceRef.current);
    }
    
    // Set a new debounce timer
    const debounceTimer = setTimeout(async () => {
      await saveToBackend(updatedData);
    }, 1000); // 1 second debounce
    
    // Store the timer reference
    hoursDebounceRef.current = debounceTimer;
    daysDebounceRef.current = debounceTimer;
  }, [id, memberData, updateNodeData, saveToBackend]);

  // Validation handlers
  const validateHoursPerDay = useCallback((hours: number) => {
    clearErrors(id);
    if (hours < 0 || hours > 24) {
      addError(id, {
        nodeId: id,
        field: 'hoursPerDay',
        message: 'Hours must be between 0 and 24'
      });
    }
  }, [id, addError, clearErrors]);

  const validateDaysPerWeek = useCallback((days: number) => {
    clearErrors(id);
    if (days < 0 || days > 7) {
      addError(id, {
        nodeId: id,
        field: 'daysPerWeek',
        message: 'Days must be between 0 and 7'
      });
    }
  }, [id, addError, clearErrors]);

  const validateDailyRate = useCallback((rate: number) => {
    clearErrors(id);
    if (rate < 0) {
      addError(id, {
        nodeId: id,
        field: 'dailyRate',
        message: 'Daily rate cannot be negative'
      });
    }
  }, [id, addError, clearErrors]);

  // Add validation handler for start date
  const validateStartDate = useCallback((dateStr: string) => {
    clearErrors(id);
    const date = new Date(dateStr);
    const earliest = new Date(EARLIEST_START_DATE);
    
    if (date < earliest) {
      addError(id, {
        nodeId: id,
        field: 'startDate',
        message: 'Start date cannot be earlier than January 1, 2020'
      });
    }
  }, [id, addError, clearErrors]);

  // Update the input handlers to include validation and backend saving
  const handleHoursPerDayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = Math.min(Math.max(0, Number(e.target.value)), 24);
    updateWeeklyCapacity(hours, memberData.daysPerWeek ?? 5);
  }, [memberData.daysPerWeek, updateWeeklyCapacity]);

  const handleDaysPerWeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const days = Math.min(Math.max(0, Number(e.target.value)), 7);
    updateWeeklyCapacity(memberData.hoursPerDay ?? 8, days);
  }, [memberData.hoursPerDay, updateWeeklyCapacity]);

  const handleDailyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    if (!isNaN(rate)) {
      const updatedData: Partial<RFTeamMemberNodeData> = { dailyRate: rate };
      updateNodeData(id, { ...memberData, ...updatedData });
      
      // Clear any existing debounce timer
      if (rateDebounceRef.current) {
        clearTimeout(rateDebounceRef.current);
      }
      
      // Set a new debounce timer
      rateDebounceRef.current = setTimeout(async () => {
        await saveToBackend(updatedData);
        rateDebounceRef.current = null;
      }, 1000); // 1 second debounce
    }
  }, [id, memberData, updateNodeData, saveToBackend]);

  // Update the start date handler
  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const startDate = e.target.value || DEFAULT_START_DATE;
    const updatedData: Partial<RFTeamMemberNodeData> = { startDate };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (startDateDebounceRef.current) {
      clearTimeout(startDateDebounceRef.current);
    }
    
    // Set a new debounce timer
    startDateDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      startDateDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, memberData, updateNodeData, saveToBackend]);

  const handleDelete = useCallback(() => {
    // Delete the node from the backend
    GraphApiClient.deleteNode('teamMember' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete connected edges
        const connectedEdges = getNodes().filter((node) => 
          connections.some(conn => conn.source === node.id || conn.target === node.id)
        );
        
        if (connectedEdges.length > 0) {
          console.log('Deleting connected edges for team member:', connectedEdges);
        }
      })
      .catch((error) => {
        console.error('Failed to delete team member node:', error);
        toast.error("Delete Failed: Failed to delete the team member node from the server.");
      });
  }, [id, setNodes, getNodes, connections]);

  // Calculate member summary data
  const memberSummary = useMemo<TeamMemberSummary>(() => ({
    id,
    weeklyCapacity: memberData.weeklyCapacity || 0,
    dailyRate: memberData.dailyRate || 0,
    roles: memberData.roles || [],
    allocation: memberData.allocation || 0,
    startDate: memberData.startDate
  }), [
    id,
    memberData.weeklyCapacity,
    memberData.dailyRate,
    memberData.roles,
    memberData.allocation,
    memberData.startDate
  ]);

  // Add handler for roles with backend saving
  const handleRolesChange = useCallback((role: string, checked: boolean) => {
    const updatedRoles = checked 
      ? [...(memberData.roles || []), role]
      : (memberData.roles || []).filter(r => r !== role);
    
    const updatedData: Partial<RFTeamMemberNodeData> = { roles: updatedRoles };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (rolesDebounceRef.current) {
      clearTimeout(rolesDebounceRef.current);
    }
    
    // Set a new debounce timer
    rolesDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      rolesDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, memberData, updateNodeData, saveToBackend]);

  // Update title handler to also update name for consistency and save to backend
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    const updatedData: Partial<RFTeamMemberNodeData> = { 
      title,
      name: title // Keep name in sync with title
    };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, memberData, updateNodeData, saveToBackend]);

  // Update bio handler to also update description for consistency and save to backend
  const handleBioChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const bio = e.target.value;
    const updatedData: Partial<RFTeamMemberNodeData> = { 
      bio,
      description: bio // Keep description in sync with bio
    };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (bioDebounceRef.current) {
      clearTimeout(bioDebounceRef.current);
    }
    
    // Set a new debounce timer
    bioDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      bioDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, memberData, updateNodeData, saveToBackend]);

  // Add handler for timezone with backend saving
  const handleTimezoneChange = useCallback((timezone: string) => {
    const updatedData: Partial<RFTeamMemberNodeData> = { timezone };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (timezoneDebounceRef.current) {
      clearTimeout(timezoneDebounceRef.current);
    }
    
    // Set a new debounce timer
    timezoneDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      timezoneDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, memberData, updateNodeData, saveToBackend]);

  // Add this after the timezone handler
  const handleAllocationChange = useCallback((allocation: number) => {
    const updatedData: Partial<RFTeamMemberNodeData> = { allocation };
    updateNodeData(id, { ...memberData, ...updatedData });
    
    // Clear any existing debounce timer
    if (allocationDebounceRef.current) {
      clearTimeout(allocationDebounceRef.current);
    }
    
    // Set a new debounce timer
    allocationDebounceRef.current = setTimeout(async () => {
      await saveToBackend(updatedData);
      allocationDebounceRef.current = null;
    }, 1000); // 1 second debounce

    // Also update the team node if connected
    const teamConnection = connections.find(conn => {
      return (conn.source === id && isTeamNode(getNode(conn.target))) || 
             (conn.target === id && isTeamNode(getNode(conn.source)));
    });

    if (teamConnection) {
      const teamNodeId = teamConnection.source === id ? teamConnection.target : teamConnection.source;
      const teamNode = getNode(teamNodeId);
      
      if (isTeamNode(teamNode)) {
        // Ensure roster is an array before using array methods
        const rosterArray = Array.isArray(teamNode.data.roster) ? teamNode.data.roster : [];
        const updatedRoster = rosterArray.map((member: RosterMember) => {
          if (member.memberId === id) {
            return { ...member, allocation };
          }
          return member;
        });
        
        updateNodeData(teamNodeId, {
          ...teamNode.data,
          roster: updatedRoster
        });
        
        // Save the updated roster to the backend using GraphApiClient
        GraphApiClient.updateNode('team', teamNodeId, { roster: updatedRoster });
      }
    }
  }, [id, memberData, updateNodeData, saveToBackend, connections, getNode]);

  // Update connection handling to pass summary data
  useEffect(() => {
    const teamConnection = connections.find(conn => {
      const node = getNodes().find(n => n.id === conn.target);
      return node?.type === 'team';
    });

    if (teamConnection) {
      const teamId = teamConnection.target;
      if (teamId !== memberData.teamId) {
        const updatedData: Partial<RFTeamMemberNodeData> = {
          teamId,
          allocation: 100,
        };
        updateNodeData(id, { ...memberData, ...updatedData });
        
        // Save team connection to backend
        saveToBackend({
          ...updatedData,
          memberSummary
        });
      }
    } else {
      if (memberData.teamId) {
        const updatedData: Partial<RFTeamMemberNodeData> = {
          teamId: undefined,
          allocation: undefined,
        };
        updateNodeData(id, { ...memberData, ...updatedData });
        
        // Save removal of team connection to backend
        saveToBackend({
          ...updatedData,
          memberSummary: undefined
        });
      }
    }
  }, [
    connections, 
    memberData, 
    id, 
    updateNodeData, 
    getNodes, 
    memberSummary,
    saveToBackend
  ]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (bioDebounceRef.current) clearTimeout(bioDebounceRef.current);
      if (hoursDebounceRef.current) clearTimeout(hoursDebounceRef.current);
      if (daysDebounceRef.current) clearTimeout(daysDebounceRef.current);
      if (rateDebounceRef.current) clearTimeout(rateDebounceRef.current);
      if (startDateDebounceRef.current) clearTimeout(startDateDebounceRef.current);
      if (rolesDebounceRef.current) clearTimeout(rolesDebounceRef.current);
      if (timezoneDebounceRef.current) clearTimeout(timezoneDebounceRef.current);
      if (allocationDebounceRef.current) clearTimeout(allocationDebounceRef.current);
    };
  }, []);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={memberData.title || ''}
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
        {/* Capacity Section */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Hours per Day</Label>
            <Input
              type="number"
              value={memberData.hoursPerDay ?? 8}
              onChange={handleHoursPerDayChange}
              onBlur={(e) => validateHoursPerDay(Number(e.target.value))}
              min={0}
              max={24}
              className={cn(
                "bg-transparent",
                getErrors(id).some(e => e.field === 'hoursPerDay') && 
                "border-destructive"
              )}
            />
            {getErrors(id)
              .filter(e => e.field === 'hoursPerDay')
              .map(error => (
                <span key={error.field} className="text-xs text-destructive">
                  {error.message}
                </span>
              ))
            }
          </div>
          <div className="space-y-2">
            <Label>Days per Week</Label>
            <Input
              type="number"
              value={memberData.daysPerWeek ?? 5}
              onChange={handleDaysPerWeekChange}
              onBlur={(e) => validateDaysPerWeek(Number(e.target.value))}
              min={0}
              max={7}
              className={cn(
                "bg-transparent",
                getErrors(id).some(e => e.field === 'daysPerWeek') && 
                "border-destructive"
              )}
            />
            {getErrors(id)
              .filter(e => e.field === 'daysPerWeek')
              .map(error => (
                <span key={error.field} className="text-xs text-destructive">
                  {error.message}
                </span>
              ))
            }
          </div>
        </div>

        <div className="space-y-2">
          <Label>Daily Rate</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={memberData.dailyRate ?? 350}
              onChange={handleDailyRateChange}
              onBlur={(e) => validateDailyRate(Number(e.target.value))}
              className={cn(
                "pl-7 bg-transparent",
                getErrors(id).some(e => e.field === 'dailyRate') && 
                "border-destructive"
              )}
              placeholder="0.00"
              min={0}
              step={0.01}
            />
            {getErrors(id)
              .filter(e => e.field === 'dailyRate')
              .map(error => (
                <span key={error.field} className="text-xs text-destructive">
                  {error.message}
                </span>
              ))
            }
          </div>
        </div>

        {/* Weekly Capacity Display */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Weekly Capacity</Label>
            <span className="text-sm font-mono">{memberData.weeklyCapacity || 0} hours</span>
          </div>
        </div>

        {/* Team Allocation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Allocation</Label>
            <span className="text-xs font-medium">{memberData.allocation || 0}%</span>
          </div>
          <Slider
            value={[memberData.allocation || 0]}
            min={0}
            max={100}
            step={5}
            onValueChange={(values) => handleAllocationChange(values[0])}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">
            {Math.round(((memberData.weeklyCapacity || 0) * (memberData.allocation || 0)) / 100)} hours per week
          </div>
        </div>

        {/* Role & Timezone */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="space-y-2">
              {/* Base Roles */}
              {BASE_ROLES.map((role) => (
                <div key={role} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={(memberData.roles || []).includes(role)}
                    onCheckedChange={(checked) => 
                      handleRolesChange(role, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`role-${role}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {role}
                  </label>
                </div>
              ))}

              {/* Custom Roles */}
              {(memberData.roles || [])
                .filter(role => !BASE_ROLES.includes(role as any))
                .map(role => (
                  <div key={role} className="flex items-center space-x-2 group">
                    <Checkbox
                      id={`role-${role}`}
                      checked={true}
                      onCheckedChange={(checked) => {
                        if (!checked) handleRolesChange(role, false);
                      }}
                    />
                    <label
                      htmlFor={`role-${role}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {role}
                    </label>
                    <button 
                      onClick={() => handleRolesChange(role, false)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
                ))}

              {/* Add new role input */}
              <Input
                placeholder="Add custom role..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    const newRole = input.value.trim();
                    if (newRole && !(memberData.roles || []).includes(newRole)) {
                      handleRolesChange(newRole, true);
                      input.value = '';
                    }
                  }
                }}
                className="mt-2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select 
              value={memberData.timezone || ''} 
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
        </div>

        {/* Start Date */}
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={memberData.startDate || DEFAULT_START_DATE}
            onChange={handleStartDateChange}
            onBlur={(e) => validateStartDate(e.target.value)}
            min={EARLIEST_START_DATE}
            max="2030-12-31"
            className={cn(
              "bg-transparent",
              getErrors(id).some(e => e.field === 'startDate') && 
              "border-destructive"
            )}
          />
          {getErrors(id)
            .filter(e => e.field === 'startDate')
            .map(error => (
              <span key={error.field} className="text-xs text-destructive">
                {error.message}
              </span>
            ))
          }
        </div>

        {/* Bio Section */}
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea
            value={memberData.bio || ''}
            onChange={handleBioChange}
            placeholder="Team member's bio..."
            className="min-h-[80px] resize-y bg-transparent"
          />
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
