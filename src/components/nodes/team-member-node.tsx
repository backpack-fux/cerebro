"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RFTeamMemberNodeData, Role } from '@/services/graph/team-member/team-member.types';
import { useValidation } from '@/contexts/validation-context';
import { useTeamMemberNode } from '@/hooks/useTeamMemberNode';
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Common roles for team members
const COMMON_ROLES: Role[] = [
  'Developer',
  'Designer',
  'Product Manager',
  'Project Manager',
  'QA Engineer',
  'DevOps Engineer',
  'Data Scientist',
  'UX Researcher',
];

// Define the component with explicit typing
const TeamMemberNode = memo(({ id, data, selected }: NodeProps) => {
  const { addError, clearErrors, getErrors } = useValidation();
  
  // Use the team member node hook to manage state and operations
  const teamMember = useTeamMemberNode(id, data as RFTeamMemberNodeData, addError, clearErrors, getErrors);
  
  // State for custom role input
  const [customRole, setCustomRole] = React.useState('');

  const handleAddCustomRole = () => {
    if (customRole && !teamMember.roles.includes(customRole)) {
      teamMember.handleRolesChange(customRole, true);
      setCustomRole('');
    }
  };

  // Get validation errors
  const errors = getErrors ? getErrors(id) : [];
  const getErrorMessage = (field: string): string => {
    const error = errors.find(e => e.field === field);
    return error ? error.message : '';
  };

  return (
    <BaseNode selected={selected} className="w-[350px] min-h-[200px]">
      <Handle type="source" position={Position.Top} id="source" />
      <Handle type="target" position={Position.Bottom} id="target" />
      
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${teamMember.getStatusColor(teamMember.status)}`}
              onClick={teamMember.cycleStatus}
            >
              {teamMember.status}
            </Badge>
            <input
              value={teamMember.title}
              onChange={(e) => teamMember.handleTitleChange(e.target.value)}
              className="bg-transparent outline-none w-full"
              placeholder="Team Member Name"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <button 
            onClick={teamMember.refreshData}
            className="p-1 rounded-md hover:bg-muted"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NodeHeaderMenuAction label="Provider Actions">
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={teamMember.handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 space-y-4">
        {/* Hours, Days, Rate */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor={`hours-${id}`}>Hours/Day</Label>
            <Input
              id={`hours-${id}`}
              type="number"
              min={0}
              max={24}
              value={teamMember.hoursPerDay}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                teamMember.handleHoursPerDayChange(value);
                teamMember.validateHoursPerDay(value);
              }}
              className={getErrorMessage('hoursPerDay') ? 'border-red-500' : ''}
            />
            {getErrorMessage('hoursPerDay') && (
              <p className="text-xs text-red-500">{getErrorMessage('hoursPerDay')}</p>
            )}
          </div>
          <div>
            <Label htmlFor={`days-${id}`}>Days/Week</Label>
            <Input
              id={`days-${id}`}
              type="number"
              min={0}
              max={7}
              value={teamMember.daysPerWeek}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                teamMember.handleDaysPerWeekChange(value);
                teamMember.validateDaysPerWeek(value);
              }}
              className={getErrorMessage('daysPerWeek') ? 'border-red-500' : ''}
            />
            {getErrorMessage('daysPerWeek') && (
              <p className="text-xs text-red-500">{getErrorMessage('daysPerWeek')}</p>
            )}
          </div>
          <div>
            <Label htmlFor={`rate-${id}`}>Daily Rate</Label>
            <Input
              id={`rate-${id}`}
              type="number"
              min={0}
              value={teamMember.dailyRate}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                teamMember.handleDailyRateChange(value);
                teamMember.validateDailyRate(value);
              }}
              className={getErrorMessage('dailyRate') ? 'border-red-500' : ''}
            />
            {getErrorMessage('dailyRate') && (
              <p className="text-xs text-red-500">{getErrorMessage('dailyRate')}</p>
            )}
          </div>
        </div>

        {/* Weekly Capacity */}
        <div>
          <div className="flex justify-between">
            <Label>Weekly Capacity</Label>
            <span className="text-sm">{teamMember.weeklyCapacity} hours</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full mt-1">
            <div
              className="h-2 bg-primary rounded-full"
              style={{ 
                width: `${Math.min(100, (teamMember.weeklyCapacity / (8 * 5)) * 100)}%`,
                maxWidth: '100%'
              }}
              title={`${teamMember.weeklyCapacity} hours (${teamMember.hoursPerDay} hours × ${teamMember.daysPerWeek} days)`}
            ></div>
          </div>
        </div>

        {/* Team Allocation */}
        <div>
          <div className="flex justify-between">
            <Label>Team Allocation</Label>
            <span className="text-sm font-medium">{teamMember.allocation}%</span>
          </div>
          <div className="relative mt-2">
            <Slider
              value={[teamMember.allocation]}
              min={0}
              max={100}
              step={5}
              onValueChange={(values) => teamMember.handleAllocationChange(values[0])}
              className="mt-2"
              aria-label="Team allocation percentage"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Effective Capacity (after allocation) */}
        <div className="mt-3">
          <div className="flex justify-between">
            <Label>Effective Capacity</Label>
            <span className="text-sm">{(teamMember.weeklyCapacity * teamMember.allocation / 100).toFixed(1)} hours</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full mt-1">
            <div
              className="h-2 bg-secondary rounded-full"
              style={{ 
                width: `${Math.min(100, ((teamMember.weeklyCapacity * teamMember.allocation / 100) / (8 * 5)) * 100)}%`,
                maxWidth: '100%'
              }}
              title={`${(teamMember.weeklyCapacity * teamMember.allocation / 100).toFixed(1)} effective hours (${teamMember.allocation}% of ${teamMember.weeklyCapacity} hours)`}
            ></div>
          </div>
        </div>

        {/* Roles */}
        <div>
          <Label className="mb-2 block">Roles</Label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {COMMON_ROLES.map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${role}-${id}`}
                  checked={teamMember.roles.includes(role)}
                  onCheckedChange={(checked) => teamMember.handleRolesChange(role, checked === true)}
                />
                <Label htmlFor={`role-${role}-${id}`} className="text-sm">
                  {role}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add custom role"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCustomRole}
              disabled={!customRole}
            >
              Add
            </Button>
          </div>
          {teamMember.roles.filter(r => !COMMON_ROLES.includes(r)).length > 0 && (
            <div className="mt-2">
              <Label className="text-sm">Custom Roles:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {teamMember.roles.filter(r => !COMMON_ROLES.includes(r)).map(role => (
                  <div key={role} className="bg-muted text-xs px-2 py-1 rounded-md flex items-center">
                    {role}
                    <button
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => teamMember.handleRolesChange(role, false)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timezone */}
        <div>
          <Label htmlFor={`timezone-${id}`}>Timezone</Label>
          <Select
            value={teamMember.timezone}
            onValueChange={teamMember.handleTimezoneChange}
          >
            <SelectTrigger id={`timezone-${id}`}>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {teamMember.TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start Date */}
        <div>
          <Label htmlFor={`start-date-${id}`}>Start Date</Label>
          <Input
            id={`start-date-${id}`}
            type="date"
            value={teamMember.startDate}
            min={teamMember.EARLIEST_START_DATE}
            onChange={(e) => {
              teamMember.handleStartDateChange(e.target.value);
              teamMember.validateStartDate(e.target.value);
            }}
            className={getErrorMessage('startDate') ? 'border-red-500' : ''}
          />
          {getErrorMessage('startDate') && (
            <p className="text-xs text-red-500">{getErrorMessage('startDate')}</p>
          )}
        </div>

        {/* Bio */}
        <div>
          <Label htmlFor={`bio-${id}`}>Bio</Label>
          <Textarea
            id={`bio-${id}`}
            placeholder="Team member bio"
            value={teamMember.bio}
            onChange={(e) => teamMember.handleBioChange(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </BaseNode>
  );
});

TeamMemberNode.displayName = 'TeamMemberNode';

export { TeamMemberNode };
