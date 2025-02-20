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
import { useCallback, useMemo, useEffect } from "react";
import { useReactFlow, useNodeConnections } from "@xyflow/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useValidation } from '@/contexts/validation-context';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";

// Common timezones - can be expanded
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

// Add at the top with other constants
const DEFAULT_START_DATE = '2025-01-01';
const EARLIEST_START_DATE = '2020-01-01';

export type Role = string;

export const BASE_ROLES = [
  'operator',
  'builder', 
  'compliance',
  'ambassador',
] as const;

export interface TeamAllocation {
  teamId: string;
  percentage: number;
}

// Define the data structure as a Record type
export interface TeamMemberData extends Record<string, unknown> {
  title: string;
  roles: Role[];  // Change from single role to array
  bio?: string;
  timezone?: string;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
  startDate?: string;
  skills?: string[];
  teamId?: string;        // Single team ID instead of array
  allocation?: number;    // Single allocation percentage
}

// Define the node type
export type TeamMemberNodeData = Node<TeamMemberData>;

// Add this type to define the summary data structure
export interface TeamMemberSummary {
  id: string;
  weeklyCapacity: number;
  dailyRate: number;
  roles: Role[];  // Update to array
  allocation: number;
}

export function TeamMemberNode({ 
  id, 
  data, 
  selected 
}: NodeProps) {
  const { updateNodeData, setNodes, getNodes } = useReactFlow();
  const { addError, clearErrors, getErrors } = useValidation();
  const connections = useNodeConnections({ id });

  // Type guard for data
  const typedData = data as TeamMemberData;

  // Initialize with defaults if values are undefined
  useEffect(() => {
    if (typedData.hoursPerDay === undefined || 
        typedData.daysPerWeek === undefined || 
        !typedData.startDate) {
      updateNodeData(id, {
        ...typedData,
        hoursPerDay: typedData.hoursPerDay ?? 12,
        daysPerWeek: typedData.daysPerWeek ?? 6,
        weeklyCapacity: (typedData.hoursPerDay ?? 12) * (typedData.daysPerWeek ?? 6),
        startDate: typedData.startDate ?? DEFAULT_START_DATE
      });
    }
  }, [id, typedData, updateNodeData]);

  // Calculate weekly capacity
  const updateWeeklyCapacity = useCallback((hoursPerDay: number, daysPerWeek: number) => {
    const updatedData: TeamMemberData = {
      ...typedData,
      hoursPerDay,
      daysPerWeek,
      weeklyCapacity: hoursPerDay * daysPerWeek
    };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

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

  // Update the input handlers to include validation
  const handleHoursPerDayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = Math.min(Math.max(0, Number(e.target.value)), 24);
    updateWeeklyCapacity(hours, typedData.daysPerWeek ?? 5);
  }, [typedData.daysPerWeek, updateWeeklyCapacity]);

  const handleDaysPerWeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const days = Math.min(Math.max(0, Number(e.target.value)), 7);
    updateWeeklyCapacity(typedData.hoursPerDay ?? 8, days);
  }, [typedData.hoursPerDay, updateWeeklyCapacity]);

  const handleDailyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    if (!isNaN(rate)) {
      const updatedData: TeamMemberData = { ...typedData, dailyRate: rate };
      updateNodeData(id, updatedData);
    }
  }, [id, typedData, updateNodeData]);

  // Update the start date handler
  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedData: TeamMemberData = { 
      ...typedData, 
      startDate: e.target.value || DEFAULT_START_DATE 
    };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  // Calculate member summary data
  const memberSummary = useMemo<TeamMemberSummary>(() => ({
    id,
    weeklyCapacity: typedData.weeklyCapacity ?? 0,
    dailyRate: typedData.dailyRate ?? 0,
    roles: typedData.roles ?? [],
    allocation: typedData.allocation ?? 0
  }), [
    id,
    typedData.weeklyCapacity,
    typedData.dailyRate,
    typedData.roles,
    typedData.allocation
  ]);

  // Add handler for roles
  const handleRolesChange = useCallback((role: string, checked: boolean) => {
    const updatedRoles = checked 
      ? [...(typedData.roles || []), role]
      : (typedData.roles || []).filter(r => r !== role);
    
    const updatedData: TeamMemberData = { 
      ...typedData, 
      roles: updatedRoles 
    };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  // Update connection handling to pass summary data
  useEffect(() => {
    const teamConnection = connections.find(conn => {
      const node = getNodes().find(n => n.id === conn.target);
      return node?.type === 'team';
    });

    if (teamConnection) {
      const teamId = teamConnection.target;
      if (teamId !== typedData.teamId) {
        const updatedData: TeamMemberData = {
          ...typedData,
          teamId,
          allocation: 100,
          // Add summary data to the connection
          memberSummary // This will be available to the team node
        };
        updateNodeData(id, updatedData);
      }
    } else {
      if (typedData.teamId) {
        const updatedData: TeamMemberData = {
          ...typedData,
          teamId: undefined,
          allocation: undefined,
          memberSummary: undefined
        };
        updateNodeData(id, updatedData);
      }
    }
  }, [
    connections, 
    typedData, 
    id, 
    updateNodeData, 
    getNodes, 
    memberSummary // Add to dependencies
  ]);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={typedData.title}
            onChange={(e) => {
              const updatedData: TeamMemberData = { ...typedData, title: e.target.value };
              updateNodeData(id, updatedData);
            }}
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
              value={typedData.hoursPerDay ?? 12}
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
              value={typedData.daysPerWeek ?? 6}
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
              value={typedData.dailyRate ?? 350}
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
            <span className="text-sm font-mono">{typedData.weeklyCapacity} hours</span>
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
                    checked={(typedData.roles || []).includes(role)}
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
              {(typedData.roles || [])
                .filter(role => !BASE_ROLES.includes(role as typeof BASE_ROLES[number]))
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
                    if (newRole && !(typedData.roles || []).includes(newRole)) {
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
              value={typedData.timezone} 
              onValueChange={(timezone: string) => {
                const updatedData: TeamMemberData = { ...typedData, timezone };
                updateNodeData(id, updatedData);
              }}
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
            value={typedData.startDate || DEFAULT_START_DATE}
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
            value={typedData.bio || ''}
            onChange={(e) => {
              const updatedData: TeamMemberData = { ...typedData, bio: e.target.value };
              updateNodeData(id, updatedData);
            }}
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
