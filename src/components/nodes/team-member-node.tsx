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

export type Role = 'engineer' | 'designer' | 'product' | 'data' | 'research' | 'operations';

export interface TeamAllocation {
  teamId: string;
  percentage: number;
}

// Define the data structure as a Record type
export interface TeamMemberData extends Record<string, unknown> {
  title: string;
  role: Role;
  bio?: string;
  timezone?: string;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
  startDate?: string;
  skills?: string[];
  teamAllocations: TeamAllocation[];
}

// Define the node type
export type TeamMemberNodeData = Node<TeamMemberData>;

export function TeamMemberNode({ 
  id, 
  data, 
  selected 
}: NodeProps) {
  const { updateNodeData, setNodes, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id });

  // Type guard for data
  const typedData = data as TeamMemberData;

  // Initialize with defaults if values are undefined
  useEffect(() => {
    if (typedData.hoursPerDay === undefined || typedData.daysPerWeek === undefined) {
      updateNodeData(id, {
        ...typedData,
        hoursPerDay: typedData.hoursPerDay ?? 12, // Default to 8 hours
        daysPerWeek: typedData.daysPerWeek ?? 6,  // Default to 5 days
        weeklyCapacity: (typedData.hoursPerDay ?? 12) * (typedData.daysPerWeek ?? 6)
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

  const handleHoursPerDayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = Math.min(Math.max(0, Number(e.target.value)), 24);
    updateWeeklyCapacity(hours, typedData.daysPerWeek ?? 5);
  }, [typedData.daysPerWeek, updateWeeklyCapacity]);

  const handleDaysPerWeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const days = Math.min(Math.max(0, Number(e.target.value)), 7);
    updateWeeklyCapacity(typedData.hoursPerDay ?? 8, days);
  }, [typedData.hoursPerDay, updateWeeklyCapacity]);

  // Update team allocations when connections change
  useEffect(() => {
    // Get all teams this member is connected to
    const connectedTeams = connections
      .filter(conn => {
        const node = getNodes().find(n => n.id === conn.target);
        return node?.type === 'team';  // Only keep team connections
      })
      .map(conn => conn.target);  // Get team IDs

    // Find which teams are newly connected
    const currentTeams = new Set(typedData.teamAllocations?.map(a => a.teamId));
    const newTeams = connectedTeams.filter(teamId => !currentTeams.has(teamId));
    
    // If there are new team connections
    if (newTeams.length > 0) {
      // Initialize each new team with 0% allocation
      const newAllocations: TeamAllocation[] = newTeams.map(teamId => ({
        teamId,
        percentage: 0  // Start with 0% allocation
      }));
      
      // Update the member node data with the new allocations
      const updatedData: TeamMemberData = {
        ...typedData,
        teamAllocations: [...(typedData.teamAllocations || []), ...newAllocations]
      };
      updateNodeData(id, updatedData);
    }
  }, [connections, typedData, id, updateNodeData, getNodes]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedData: TeamMemberData = { ...typedData, title: e.target.value };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  const handleRoleChange = useCallback((role: Role) => {
    const updatedData: TeamMemberData = { ...typedData, role };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  const handleBioChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const updatedData: TeamMemberData = { ...typedData, bio: e.target.value };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  const handleTimezoneChange = useCallback((timezone: string) => {
    const updatedData: TeamMemberData = { ...typedData, timezone };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  const handleDailyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    if (!isNaN(rate)) {
      const updatedData: TeamMemberData = { ...typedData, dailyRate: rate };
      updateNodeData(id, updatedData);
    }
  }, [id, typedData, updateNodeData]);

  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedData: TeamMemberData = { ...typedData, startDate: e.target.value };
    updateNodeData(id, updatedData);
  }, [id, typedData, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={typedData.title}
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
              value={typedData.hoursPerDay ?? 12}
              onChange={handleHoursPerDayChange}
              min={0}
              max={24}
              className="bg-transparent"
            />
          </div>
          <div className="space-y-2">
            <Label>Days per Week</Label>
            <Input
              type="number"
              value={typedData.daysPerWeek ?? 6}
              onChange={handleDaysPerWeekChange}
              min={0}
              max={7}
              className="bg-transparent"
            />
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
              className="pl-7 bg-transparent"
              placeholder="0.00"
              min={0}
              step={0.01}
            />
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
            <Label>Role</Label>
            <Select 
              value={typedData.role} 
              onValueChange={handleRoleChange}
            >
              <SelectTrigger className="bg-transparent">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engineer">Engineer</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select 
              value={typedData.timezone} 
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
            value={typedData.startDate || ''}
            onChange={handleStartDateChange}
            className="bg-transparent"
          />
        </div>

        {/* Bio Section */}
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea
            value={typedData.bio || ''}
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
