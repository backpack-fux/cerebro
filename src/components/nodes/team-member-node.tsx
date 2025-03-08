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
import { cn } from '@/lib/utils';
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

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
  
  // Use the hook to manage state and operations
  const {
    // Data
    title,
    bio,
    roles,
    timezone,
    dailyRate,
    hoursPerDay,
    daysPerWeek,
    weeklyCapacity,
    startDate,
    allocation,
    
    // Validation
    validateHoursPerDay,
    validateDaysPerWeek,
    validateDailyRate,
    validateStartDate,
    
    // Actions
    handleTitleChange,
    handleBioChange,
    handleHoursPerDayChange,
    handleDaysPerWeekChange,
    handleDailyRateChange,
    handleStartDateChange,
    handleRolesChange,
    handleTimezoneChange,
    handleAllocationChange,
    handleDelete,
    
    // Constants
    TIMEZONES,
    DEFAULT_START_DATE,
    EARLIEST_START_DATE,
  } = useTeamMemberNode(id, data as RFTeamMemberNodeData, addError, clearErrors, getErrors);

  // State for custom role input
  const [customRole, setCustomRole] = React.useState('');

  // Handle adding a custom role
  const handleAddCustomRole = () => {
    if (customRole && !roles.includes(customRole)) {
      handleRolesChange(customRole, true);
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
      <NodeHeader>
        <NodeHeaderTitle>
          <Input
            placeholder="Team Member Name"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Team Member options">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer text-red-600">
              Delete Team Member
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
              value={hoursPerDay}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                handleHoursPerDayChange(value);
                validateHoursPerDay(value);
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
              value={daysPerWeek}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                handleDaysPerWeekChange(value);
                validateDaysPerWeek(value);
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
              value={dailyRate}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                handleDailyRateChange(value);
                validateDailyRate(value);
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
            <span className="text-sm">{weeklyCapacity} hours</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full mt-1">
            <div
              className="h-2 bg-primary rounded-full"
              style={{ width: `${(weeklyCapacity / 40) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Team Allocation */}
        <div>
          <div className="flex justify-between">
            <Label>Team Allocation</Label>
            <span className="text-sm">{allocation}%</span>
          </div>
          <Slider
            value={[allocation]}
            min={0}
            max={100}
            step={5}
            onValueChange={(values) => handleAllocationChange(values[0])}
            className="mt-2"
          />
        </div>

        {/* Roles */}
        <div>
          <Label className="mb-2 block">Roles</Label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {COMMON_ROLES.map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${role}-${id}`}
                  checked={roles.includes(role)}
                  onCheckedChange={(checked) => handleRolesChange(role, checked === true)}
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
          {roles.filter(r => !COMMON_ROLES.includes(r)).length > 0 && (
            <div className="mt-2">
              <Label className="text-sm">Custom Roles:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {roles.filter(r => !COMMON_ROLES.includes(r)).map(role => (
                  <div key={role} className="bg-muted text-xs px-2 py-1 rounded-md flex items-center">
                    {role}
                    <button
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRolesChange(role, false)}
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
            value={timezone}
            onValueChange={handleTimezoneChange}
          >
            <SelectTrigger id={`timezone-${id}`}>
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

        {/* Start Date */}
        <div>
          <Label htmlFor={`start-date-${id}`}>Start Date</Label>
          <Input
            id={`start-date-${id}`}
            type="date"
            value={startDate}
            min={EARLIEST_START_DATE}
            onChange={(e) => {
              handleStartDateChange(e.target.value);
              validateStartDate(e.target.value);
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
            value={bio}
            onChange={(e) => handleBioChange(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Handles for connections */}
      <Handle
        type="source"
        position={Position.Top}
        id="source"
        className="w-3 h-3 bg-primary"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target"
        className="w-3 h-3 bg-primary"
      />
    </BaseNode>
  );
});

TeamMemberNode.displayName = 'TeamMemberNode';

export { TeamMemberNode };
