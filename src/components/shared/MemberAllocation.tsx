"use client";

import React from 'react';
import { User } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { 
  formatHours, 
  formatPercentage, 
  calculateWeeklyCapacity, 
  percentageToHours,
  MemberCapacity
} from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Interface for available member data
 */
export interface AvailableMember {
  memberId: string;
  name: string;
  availableHours?: number;
  dailyRate: number;
  hoursPerDay?: number;
  daysPerWeek?: number;
  weeklyCapacity?: number;
  allocation?: number; // Team allocation percentage (0-100)
}

/**
 * Interface for member allocation data
 */
export interface MemberAllocationData {
  memberId: string;
  name?: string;
  hours: number;
  percentage?: number;
  weeklyCapacity?: number;
  memberCapacity?: MemberCapacity;
  cost: number;
  isOverAllocated?: boolean;
  availableHours?: number;
  effectiveCapacity?: number;
  overAllocatedBy?: number;
}

/**
 * Props for the MemberAllocation component
 */
export interface MemberAllocationProps {
  member: AvailableMember;
  allocation?: MemberAllocationData;
  isAllocated?: boolean;
  projectDurationDays: number;
  onValueChange: (memberId: string, value: number) => void;
  onValueCommit: (memberId: string, value: number) => void;
  isOverAllocated?: boolean;
  availableHours?: number;
  overAllocatedBy?: number;
}

/**
 * Safely format hours, handling undefined values
 */
const safeFormatHours = (hours: number | undefined): string => {
  if (hours === undefined || isNaN(Number(hours))) {
    return '0h';
  }
  return formatHours(Number(hours));
};

/**
 * Member allocation component that displays and allows editing of a member's allocation
 * Shared between feature and option nodes
 */
export const MemberAllocation: React.FC<MemberAllocationProps> = ({
  member,
  allocation,
  isAllocated = false,
  projectDurationDays,
  onValueChange,
  onValueCommit,
  isOverAllocated = false,
  availableHours,
  overAllocatedBy = 0
}) => {
  const hours = allocation?.hours || 0;
  
  // Calculate effective weekly capacity based on the member's settings
  const memberWeeklyCapacity = member.weeklyCapacity || 
                             (member.hoursPerDay || 8) * (member.daysPerWeek || 5);
                             
  // Apply team allocation percentage (default to 100% if not specified)
  const teamAllocationPercent = typeof member.allocation === 'number' ? member.allocation : 100;
  const effectiveWeeklyCapacity = memberWeeklyCapacity * (teamAllocationPercent / 100);
  
  // Calculate max hours for the slider based on available hours
  // If availableHours is explicitly provided, use that plus current allocation
  // Otherwise, calculate based on the member's effective capacity over the project duration
  const maxHours = availableHours !== undefined 
    ? (hours + availableHours) // Current hours + available hours
    : effectiveWeeklyCapacity * (projectDurationDays / 5); // Convert to project duration
  
  // Handle slider value change
  const handleValueChange = (value: number[]) => {
    if (onValueChange) {
      // Ensure the value is within bounds
      const boundedValue = Math.min(value[0], maxHours);
      onValueChange(member.memberId, boundedValue);
    }
  };
  
  // Handle slider value commit
  const handleValueCommit = (value: number[]) => {
    if (onValueCommit) {
      // Ensure the value is within bounds
      const boundedValue = Math.min(value[0], maxHours);
      onValueCommit(member.memberId, boundedValue);
    }
  };
  
  // Get available hours safely
  const displayAvailableHours = availableHours !== undefined 
    ? safeFormatHours(availableHours) 
    : member.availableHours !== undefined 
      ? safeFormatHours(member.availableHours) 
      : safeFormatHours(effectiveWeeklyCapacity * (projectDurationDays / 5));
  
  // Create a MemberCapacity object if we don't have allocation data
  if (!allocation) {
    const memberCapacity: MemberCapacity = {
      // Use the actual values from the team member if available
      hoursPerDay: member.hoursPerDay || 8,
      daysPerWeek: member.daysPerWeek || 5,
      allocation: 100
    };
    
    // Calculate weekly capacity - use the actual weeklyCapacity if available
    const weeklyCapacity = member.weeklyCapacity || calculateWeeklyCapacity(memberCapacity);
    
    // Ensure the weekly capacity is reasonable (cap at 100 hours per week)
    const normalizedWeeklyCapacity = Math.min(weeklyCapacity, 100);
    
    // Create a default allocation object
    const defaultAllocation = {
      memberId: member.memberId,
      percentage: 0,
      hours: 0,
      weeklyCapacity: normalizedWeeklyCapacity,
      memberCapacity,
      name: member.name
    };
    
    // Ensure we have a valid percentage value for the slider
    const sliderValue = 0;
    
    // Calculate weekly hours based on allocation percentage
    const weeklyHours = percentageToHours(sliderValue, normalizedWeeklyCapacity);
    
    return (
      <div className={`space-y-1 ${isOverAllocated ? 'border-l-2 border-destructive pl-2' : ''}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span>{member.name}</span>
            {isOverAllocated && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Member is over-allocated by {safeFormatHours(overAllocatedBy)} hours</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {displayAvailableHours} available
            </span>
          </div>
        </div>
        
        <div className="pt-2">
          <Slider
            defaultValue={[0]}
            value={[hours]}
            max={maxHours}
            step={1}
            onValueChange={handleValueChange}
            onValueCommit={handleValueCommit}
            disabled={!onValueChange}
            className="focus:outline-none"
            aria-label={`Allocate hours for ${member.name}`}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0h</span>
            <span className="text-center">{safeFormatHours(maxHours / 2)}</span>
            <span>{safeFormatHours(maxHours)}</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-1 ${isOverAllocated ? 'border-l-2 border-destructive pl-2' : ''}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span>{allocation.name || member.name}</span>
          {isOverAllocated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Member is over-allocated by {safeFormatHours(overAllocatedBy)} hours</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isAllocated && (
            <Badge variant="outline" className="text-xs">
              {safeFormatHours(hours)}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {displayAvailableHours} available
          </span>
        </div>
      </div>
      
      <div className="pt-2">
        <Slider
          defaultValue={[0]}
          value={[hours]}
          max={maxHours}
          step={1}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          disabled={!onValueChange}
          className="focus:outline-none"
          aria-label={`Allocate hours for ${allocation.name || member.name}`}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0h</span>
          <span className="text-center">{safeFormatHours(maxHours / 2)}</span>
          <span>{safeFormatHours(maxHours)}</span>
        </div>
      </div>
    </div>
  );
}; 