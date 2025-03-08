"use client";

import { User } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { 
  formatHours, 
  formatPercentage, 
  calculateWeeklyCapacity, 
  percentageToHours,
  MemberCapacity
} from "@/lib/utils";

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
}

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
  onValueCommit
}) => {
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
      <div className="space-y-1 p-2 rounded-md bg-background/20">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span>{defaultAllocation.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">
              {formatHours(weeklyHours)}/week
            </span>
            <span className="text-xs text-muted-foreground">
              ({formatPercentage(sliderValue)})
            </span>
          </div>
        </div>
        <Slider
          value={[sliderValue]}
          onValueChange={([value]) => {
            // Only update local state for immediate UI feedback
            onValueChange(member.memberId, value);
          }}
          onValueCommit={([value]) => {
            // Save to backend only when the user finishes dragging
            onValueCommit(member.memberId, value);
          }}
          max={100}
          step={5}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Capacity: {formatHours(normalizedWeeklyCapacity)}/week</span>
        </div>
      </div>
    );
  }
  
  // Ensure we have a valid percentage value for the slider
  const sliderValue = isNaN(allocation.percentage || 0) ? 0 : (allocation.percentage || 0);
  
  // Calculate weekly hours based on allocation percentage
  const weeklyHours = percentageToHours(sliderValue, allocation.weeklyCapacity || 40);
  
  return (
    <div className={`space-y-1 p-2 rounded-md ${isAllocated ? 'bg-background/50' : 'bg-background/20'}`}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span>{allocation.name || member.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">
            {formatHours(weeklyHours)}/week
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatPercentage(sliderValue)})
          </span>
        </div>
      </div>
      <Slider
        value={[sliderValue]}
        onValueChange={([value]) => {
          // Only update local state for immediate UI feedback
          onValueChange(member.memberId, value);
        }}
        onValueCommit={([value]) => {
          // Save to backend only when the user finishes dragging
          onValueCommit(member.memberId, value);
        }}
        max={100}
        step={5}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Total: {formatHours(allocation.hours)} for project</span>
        <span>Capacity: {formatHours(allocation.weeklyCapacity || 40)}/week</span>
      </div>
    </div>
  );
}; 