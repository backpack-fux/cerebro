"use client";

import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatHours } from "@/lib/utils";
import { MemberAllocation, MemberAllocationData } from "./MemberAllocation";
import { useAllocationEngine } from '@/hooks/useAllocationEngine';

/**
 * Interface for team data
 */
export interface TeamData {
  teamId: string;
  name: string;
  availableBandwidth: AvailableMember[];
}

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
 * Interface for team allocation data
 */
export interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: {
    memberId: string;
    name?: string;
    hours: number;
  }[];
}

/**
 * Props for TeamAllocation component
 */
export interface TeamAllocationProps {
  team: TeamData;
  teamAllocation?: TeamAllocation;
  memberAllocations: Map<string, MemberAllocationData>;
  projectDurationDays: number;
  formatMemberName: (id: string, member: any) => string;
  onMemberValueChange: (teamId: string, memberId: string, hours: number) => void;
  onMemberValueCommit: (teamId: string, memberId: string, hours: number) => void;
  timeframe?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Team allocation component that displays and allows editing of team member allocations
 * Shared between feature and option nodes
 */
export const TeamAllocation: React.FC<TeamAllocationProps> = ({
  team,
  teamAllocation,
  memberAllocations,
  projectDurationDays,
  formatMemberName,
  onMemberValueChange,
  onMemberValueCommit,
  timeframe
}) => {
  const { memberAllocations: allMemberAllocations, checkMemberAvailability, teamMembers } = useAllocationEngine();
  const allocatedMembers = teamAllocation?.allocatedMembers || [];
  const totalTeamHours = allocatedMembers.reduce((sum, m) => sum + m.hours, 0);
  
  return (
    <div className="space-y-2 bg-muted/30 p-3 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Users2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{team.name || formatMemberName(team.teamId, team)}</span>
        </div>
        <Badge variant="secondary">
          {formatHours(totalTeamHours)} total
        </Badge>
      </div>

      {/* Member Allocation Controls */}
      <div className="space-y-3 mt-2">
        {team.availableBandwidth.map(member => {
          // Use pre-calculated values from the memberAllocations map
          const allocation = memberAllocations.get(member.memberId);
          
          // Find if this member is already allocated
          const memberAllocation = allocatedMembers.find(m => m.memberId === member.memberId);
          const isAllocated = !!memberAllocation;
          
          // Find the team member data to get their actual allocation percentage
          const teamMember = teamMembers.find(tm => tm.id === member.memberId);
          const teamAllocationPercent = teamMember?.teamAllocation || 
                                      (typeof member.allocation === 'number' ? member.allocation : 100);
          
          // Get member availability information
          let isOverAllocated = false;
          let availableHours = 0;
          let overAllocatedBy = 0;
          
          if (timeframe && allMemberAllocations[member.memberId]) {
            // Check availability if we have timeframe information using the allocation engine
            // This is the most accurate way to calculate availability as it considers all allocations
            const currentHours = memberAllocation?.hours || 0;
            
            const { available, availableHours: availHours, overAllocatedBy: overBy } = 
              checkMemberAvailability(member.memberId, timeframe.startDate, timeframe.endDate, currentHours);
            
            isOverAllocated = !available;
            availableHours = availHours;
            overAllocatedBy = overBy;
          } else {
            // If no timeframe, fall back to a simpler calculation based on team allocation
            // This is less accurate but necessary when timeframe isn't available
            const weeklyCapacity = teamMember?.weeklyCapacity || 
                                 member.weeklyCapacity || 
                                 (member.hoursPerDay || 8) * (member.daysPerWeek || 5);
            
            // Calculate the effective weekly capacity (considering team allocation)
            const effectiveWeeklyCapacity = weeklyCapacity * (teamAllocationPercent / 100);
            
            // For duration-based nodes, we need to calculate total availability over the project duration
            const durationWeeks = projectDurationDays / 5; // Assuming 5 working days per week
            const totalAvailableHours = effectiveWeeklyCapacity * durationWeeks;
            
            // Calculate hours already allocated in other nodes (excluding this allocation)
            let allocatedHoursElsewhere = 0;
            if (allMemberAllocations[member.memberId]) {
              const memberData = allMemberAllocations[member.memberId];
              allocatedHoursElsewhere = memberData.allocations.reduce((sum, alloc) => {
                // Skip the current allocation when calculating elsewhere allocations
                if (teamAllocation && alloc.nodeId === teamAllocation.teamId) {
                  return sum;
                }
                return sum + alloc.totalHours;
              }, 0);
            }
            
            // Current hours in this allocation
            const currentHours = memberAllocation?.hours || 0;
            
            // Calculate actual available hours by subtracting allocations elsewhere
            availableHours = Math.max(0, totalAvailableHours - allocatedHoursElsewhere);
            
            // Check if over-allocated (current allocation exceeds available hours)
            isOverAllocated = (currentHours > 0) && (currentHours > availableHours);
            overAllocatedBy = isOverAllocated ? Math.max(0, currentHours - availableHours) : 0;
            
            console.log(`[TeamAllocation] Calculated available hours for ${member.name}:`, {
              memberId: member.memberId,
              weeklyCapacity,
              teamAllocationPercent,
              effectiveWeeklyCapacity,
              durationWeeks,
              totalAvailableHours,
              allocatedHoursElsewhere,
              currentHours,
              availableHours,
              isOverAllocated,
              overAllocatedBy
            });
          }
          
          return (
            <MemberAllocation
              key={member.memberId}
              member={{
                ...member,
                allocation: teamAllocationPercent // Ensure the correct allocation percentage is passed down
              }}
              allocation={allocation}
              isAllocated={isAllocated}
              projectDurationDays={projectDurationDays}
              isOverAllocated={isOverAllocated}
              availableHours={availableHours}
              overAllocatedBy={overAllocatedBy}
              onValueChange={(memberId, hours) => 
                onMemberValueChange(team.teamId, memberId, hours)
              }
              onValueCommit={(memberId, hours) => 
                onMemberValueCommit(team.teamId, memberId, hours)
              }
            />
          );
        })}
      </div>
    </div>
  );
}; 