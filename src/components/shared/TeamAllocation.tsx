"use client";

import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatHours } from "@/utils/utils";
import { MemberAllocation, MemberAllocationData } from "./MemberAllocation";
import { useAllocationEngine } from '@/hooks/useAllocationEngine';
import { AvailableMember } from '@/utils/types/allocation';
import type { TeamAllocation as ITeamAllocation } from '@/utils/types/allocation';
import { useMemo } from "react";

/**
 * Interface for team data
 */
export interface TeamData {
  teamId: string;
  name: string;
  availableBandwidth: AvailableMember[];
}

/**
 * Props for TeamAllocation component
 */
export interface TeamAllocationProps {
  team: TeamData;
  teamAllocation?: ITeamAllocation;
  memberAllocations: Map<string, MemberAllocationData>;
  projectDurationDays: number;
  formatMemberName: (id: string, member: AvailableMember) => string;
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
  // timeframe parameter is kept in the interface for future use but not destructured here
}) => {
  const { teamMembers } = useAllocationEngine();
  
  // Use useMemo to memoize the allocatedMembers array
  const allocatedMembers = useMemo(() => 
    teamAllocation?.allocatedMembers || [],
    [teamAllocation]
  );
  
  // Calculate total team hours with useMemo
  const totalTeamHours = useMemo(() => 
    allocatedMembers.reduce((sum, m) => sum + (m.hours || 0), 0),
    [allocatedMembers]
  );
  
  return (
    <div className="space-y-2 bg-muted/30 p-3 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Users2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{team.name || formatMemberName(team.teamId, team.availableBandwidth[0])}</span>
        </div>
        <Badge variant="secondary">
          {formatHours(totalTeamHours)} total
        </Badge>
      </div>

      {/* Member Allocation Controls */}
      <div className="space-y-3 mt-2">
        {team.availableBandwidth.map(member => {
          // Find the team member data to get their actual allocation percentage
          const teamMember = teamMembers.find(tm => tm.id === member.memberId);
          const teamAllocationPercent = teamMember?.teamAllocation || 
                                      (typeof member.allocation === 'number' ? member.allocation : 100);
          
          // Use pre-calculated values from the memberAllocations map
          const allocation = memberAllocations.get(member.memberId);
          
          // Find if this member is already allocated
          const memberAllocation = allocatedMembers.find(m => m.memberId === member.memberId);
          const isAllocated = !!memberAllocation;
          
          // Calculate effective weekly capacity
          const effectiveWeeklyCapacity = ((teamAllocationPercent) / 100) * (member.weeklyCapacity || 40);
          
          // Always use weekly capacity for consistency with feature node
          const totalAvailableHours = effectiveWeeklyCapacity;
          
          // Calculate over-allocation
          const isOverAllocated = allocation && allocation.hours > totalAvailableHours;
          const overAllocatedBy = isOverAllocated ? allocation.hours - totalAvailableHours : 0;
          
          // Calculate available hours (total capacity minus allocated hours)
          const availableHours = Math.max(0, totalAvailableHours - (memberAllocation?.hours || 0));
          
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