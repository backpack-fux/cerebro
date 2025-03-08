"use client";

import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatHours } from "@/lib/utils";
import { MemberAllocation, AvailableMember, MemberAllocationData } from "./MemberAllocation";

/**
 * Interface for team data
 */
export interface TeamData {
  teamId: string;
  name: string;
  availableBandwidth: AvailableMember[];
}

/**
 * Interface for team allocation data
 */
export interface TeamAllocationData {
  teamId: string;
  requestedHours: number;
  allocatedMembers: { memberId: string; name?: string; hours: number }[];
}

/**
 * Props for the TeamAllocation component
 */
export interface TeamAllocationProps {
  team: TeamData;
  teamAllocation?: TeamAllocationData;
  memberAllocations: Map<string, MemberAllocationData>;
  projectDurationDays: number;
  formatMemberName: (memberId: string, memberData?: any) => string;
  onMemberValueChange: (memberId: string, value: number) => void;
  onMemberValueCommit: (memberId: string, value: number) => void;
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
  onMemberValueCommit
}) => {
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
          
          return (
            <MemberAllocation
              key={member.memberId}
              member={member}
              allocation={allocation}
              isAllocated={isAllocated}
              projectDurationDays={projectDurationDays}
              onValueChange={onMemberValueChange}
              onValueCommit={onMemberValueCommit}
            />
          );
        })}
      </div>
    </div>
  );
}; 