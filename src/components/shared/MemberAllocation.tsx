"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { User } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatHours } from "@/utils/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calculateEffectiveCapacity } from "@/utils/allocation/capacity";
import { AvailableMember, MemberAllocationData as IMemberAllocationData } from "@/utils/types/allocation";

export type { IMemberAllocationData as MemberAllocationData };

/**
 * Props for the MemberAllocation component
 */
export interface MemberAllocationProps {
  member: AvailableMember;
  allocation?: IMemberAllocationData;
  isAllocated?: boolean;
  projectDurationDays?: number;
  onValueChange: (memberId: string, value: number) => void;
  onValueCommit: (memberId: string, value: number) => void;
  isOverAllocated?: boolean;
  availableHours?: number;
  overAllocatedBy?: number;
  // New optional props for better UX
  debounceMs?: number;
  feedbackOnDrag?: boolean;
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
  onValueChange,
  onValueCommit,
  isOverAllocated = false,
  availableHours,
  overAllocatedBy = 0,
  debounceMs = 100,
  feedbackOnDrag = true
}) => {
  const hours = allocation?.hours || 0;
  
  // For local state management during dragging
  const [localValue, setLocalValue] = useState<number>(hours);
  
  // Use refs for debouncing
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef<boolean>(false);
  const lastReceivedValueRef = useRef<number>(hours);
  
  // Update local value when props change, but avoid updates during user interaction
  useEffect(() => {
    if (!isUpdatingRef.current && hours !== lastReceivedValueRef.current) {
      lastReceivedValueRef.current = hours;
      setLocalValue(hours);
    }
  }, [hours]);
  
  // Calculate effective weekly capacity based on the member's settings
  const memberWeeklyCapacity = member.weeklyCapacity || 
                             (member.hoursPerDay || 8) * (member.daysPerWeek || 5);
                             
  // Apply team allocation percentage (default to 100% if not specified)
  const teamAllocationPercent = typeof member.allocation === 'number' ? member.allocation : 100;
  
  // Use the utility function to calculate effective capacity
  const effectiveWeeklyCapacity = calculateEffectiveCapacity(memberWeeklyCapacity, teamAllocationPercent);
  
  // Calculate max hours for the slider based on available hours
  // If availableHours is explicitly provided, use that plus current allocation
  // Otherwise, use the calculated effective weekly capacity
  const maxHours = availableHours !== undefined 
    ? (hours + availableHours)
    : effectiveWeeklyCapacity;
  
  // Handle slider value change with debounce
  const handleValueChange = useCallback((value: number[]) => {
    // Set local value immediately for responsive UI
    const boundedValue = Math.min(value[0], maxHours);
    setLocalValue(boundedValue);
    
    // Mark that we're in the middle of an update
    isUpdatingRef.current = true;
    
    // Clear existing timeout
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    // Only update parent if feedbackOnDrag is enabled
    if (feedbackOnDrag && onValueChange) {
      // Debounce the update to prevent too many calls
      debounceRef.current = setTimeout(() => {
        onValueChange(member.memberId, boundedValue);
        debounceRef.current = null;
      }, debounceMs);
    }
  }, [member.memberId, maxHours, onValueChange, debounceMs, feedbackOnDrag]);
  
  // Handle slider value commit
  const handleValueCommit = useCallback((value: number[]) => {
    // Clear any pending debounced updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    
    // Ensure the value is within bounds
    const boundedValue = Math.min(value[0], maxHours);
    lastReceivedValueRef.current = boundedValue;
    
    // Call parent handler
    if (onValueCommit) {
      onValueCommit(member.memberId, boundedValue);
      
      // Reset updating flag after a delay to allow state to settle
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 300);
    }
  }, [member.memberId, maxHours, onValueCommit]);
  
  // Get available hours safely
  const displayAvailableHours = availableHours !== undefined 
    ? safeFormatHours(availableHours) 
    : member.availableHours !== undefined 
      ? safeFormatHours(member.availableHours) 
      : safeFormatHours(effectiveWeeklyCapacity);
  
  // Create a MemberCapacity object if we don't have allocation data
  if (!allocation) {
    // Calculate weekly capacity - use the actual weeklyCapacity if available
    const normalizedWeeklyCapacity = Math.min(memberWeeklyCapacity, 100);
    
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
                    <p>Over allocated by {formatHours(overAllocatedBy)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Badge variant="secondary">
            {formatHours(availableHours || 0)} available
          </Badge>
        </div>
        
        <Slider
          value={[0]}
          min={0}
          max={100}
          step={5}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          className="w-full"
        />
        
        <div className="text-xs text-muted-foreground">
          {formatHours(calculateEffectiveCapacity(normalizedWeeklyCapacity, 0))} hours per week
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
              {isUpdatingRef.current ? safeFormatHours(localValue) : safeFormatHours(hours)}
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
          value={[localValue]}
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