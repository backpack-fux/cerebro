"use client";

import { useCallback } from "react";
import { calculateWeeklyCapacity } from '@/utils/utils';
import { calculateEffectiveCapacity } from '@/utils/allocation/capacity';
import { ConnectedTeam } from '@/hooks/useTeamAllocation';
import { AvailableMember } from '@/utils/types/allocation';

// Define interfaces for our data structures
interface TeamAllocation {
  teamId: string;
  allocatedMembers: Array<{
    memberId: string;
    name?: string;
    hours: number;
  }>;
}

interface MemberAllocationData {
  memberId: string;
  name: string;
  hours: number;
  cost?: number;
  capacity: number;
  allocation: number;
  daysEquivalent: number;
  percentage?: number;
  memberCapacity?: number;
  hourlyRate?: number;
  current?: {
    hours?: number;
    cost?: number;
  };
}

interface NodeData {
  teamAllocations?: TeamAllocation[];
  [key: string]: unknown;
}

interface TeamAllocationHook {
  connectedTeams: ConnectedTeam[];
  requestTeamAllocation: (
    teamId: string, 
    requestedHours: number,
    memberData?: Array<{
      memberId: string;
      name?: string;
      hours?: number;
    }>,
    saveToBackend?: boolean
  ) => TeamAllocation[] | undefined;
}

// Update AvailableMember interface to include hourlyRate
interface ExtendedAvailableMember extends AvailableMember {
  hourlyRate?: number;
}

// Utility function to round numbers to 1 decimal place for better display
const roundToOneDecimal = (num: number): number => {
  return Math.round(num * 10) / 10;
};

/**
 * Hook for managing resource allocations
 * Shared between feature and option nodes
 */
export function useResourceAllocation(
  data: NodeData,
  teamAllocationHook: TeamAllocationHook,
  getNodes: () => Array<{ id: string; data?: { title?: string } }>
) {
  /**
   * Handle allocation change - local state only (no backend save)
   * @param teamId The ID of the team
   * @param memberId The ID of the member to update
   * @param hours The allocation hours
   */
  const handleAllocationChangeLocal = useCallback((teamId: string, memberId: string, hours: number) => {
    // Find the team member in the team allocation
    const team = teamAllocationHook.connectedTeams.find((t: ConnectedTeam) => t.teamId === teamId);
    if (!team) {
      console.warn(`⚠️ Could not find team ${teamId}`);
      return;
    }
    
    const teamMember = team.availableBandwidth.find((m: AvailableMember) => m.memberId === memberId);
    if (!teamMember) {
      console.warn(`⚠️ Could not find team member ${memberId} in team ${teamId}`);
      return;
    }
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (teamMember.name || memberId.split('-')[0]);
    
    // Round hours to one decimal place for better display
    const roundedHours = roundToOneDecimal(hours);
    
    console.log(`[ResourceAllocation] Local allocation change for member ${memberId}:`, {
      hours: roundedHours,
      teamId,
      memberName
    });
    
    // Use the teamAllocationHook to update the allocation in the UI only
    teamAllocationHook.requestTeamAllocation(
      teamId, 
      roundedHours, 
      [{
        memberId,
        name: memberName,
        hours: roundedHours
      }],
      false // Don't save to backend yet
    );
    
  }, [teamAllocationHook, getNodes]);

  /**
   * Handle allocation commit - save to backend when the user finishes dragging
   * @param memberId The ID of the member to update
   * @param hours The allocation hours
   */
  const handleAllocationCommit = useCallback((teamId: string, memberId: string, hours: number) => {
    // Find the team member in the team allocation
    const team = teamAllocationHook.connectedTeams.find((t: ConnectedTeam) => t.teamId === teamId);
    if (!team) {
      console.warn(`⚠️ Could not find team ${teamId}`);
      return;
    }
    
    const teamMember = team.availableBandwidth.find((m: AvailableMember) => m.memberId === memberId);
    if (!teamMember) {
      console.warn(`⚠️ Could not find team member ${memberId} in team ${teamId}`);
      return;
    }
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (teamMember.name || memberId.split('-')[0]);
    
    // Round hours to one decimal place for better display
    const roundedHours = roundToOneDecimal(hours);
    
    console.log(`🔄 Committing allocation for member ${memberId} in team ${teamId}:`, {
      hours: roundedHours,
      memberName
    });
    
    // Use the teamAllocationHook to update the allocation and save to backend
    teamAllocationHook.requestTeamAllocation(
      teamId, 
      roundedHours, 
      [{
        memberId,
        name: memberName,
        hours: roundedHours
      }],
      true // Save to backend
    );
    
  }, [teamAllocationHook, getNodes]);

  /**
   * Calculate member allocations for display and cost calculation
   * @param connectedTeams Array of connected teams
   * @param processedTeamAllocations Array of processed team allocations
   * @param projectDurationDays Project duration in days
   * @param formatMemberName Function to format member names
   * @returns Map of member allocations
   */
  const calculateMemberAllocations = useCallback((
    connectedTeams: ConnectedTeam[],
    processedTeamAllocations: TeamAllocation[],
    projectDurationDays: number,
    formatMemberName: (memberId: string, memberData?: { title?: string }) => string
  ) => {
    const allocations = new Map<string, MemberAllocationData>();
    
    processedTeamAllocations.forEach(allocation => {
      allocation.allocatedMembers.forEach(member => {
        const memberName = member.name || formatMemberName(member.memberId);
        const team = connectedTeams.find(t => t.teamId === allocation.teamId);
        const teamMember = team?.availableBandwidth.find(m => m.memberId === member.memberId) as ExtendedAvailableMember | undefined;
        
        if (!teamMember) return;
        
        const current = allocations.get(member.memberId);
        const currentHours = current?.hours || 0;
        const currentCost = current?.cost || 0;
        
        // Calculate member capacity
        const capacity = calculateWeeklyCapacity({
          hoursPerDay: teamMember.hoursPerDay || 8,
          daysPerWeek: teamMember.daysPerWeek || 5
        });
        
        // Calculate effective capacity based on team allocation
        const effectiveCapacity = calculateEffectiveCapacity(
          capacity,
          teamMember.allocation || 100,
          projectDurationDays,
          teamMember.daysPerWeek || 5
        );
        
        const hourlyRate = teamMember.hourlyRate || 0;
        
        allocations.set(member.memberId, {
          memberId: member.memberId,
          name: memberName,
          hours: currentHours + member.hours,
          cost: currentCost + (member.hours * hourlyRate),
          capacity,
          allocation: teamMember.allocation || 100,
          daysEquivalent: (currentHours + member.hours) / (teamMember.hoursPerDay || 8),
          percentage: ((currentHours + member.hours) / effectiveCapacity) * 100,
          hourlyRate
        });
      });
    });
    
    return allocations;
  }, []);

  /**
   * Calculate cost summary for display
   * @param memberAllocations Map of member allocations
   * @returns Cost summary object
   */
  const calculateCostSummary = useCallback((memberAllocations: Map<string, MemberAllocationData>) => {
    let totalCost = 0;
    let totalHours = 0;
    let totalDays = 0;
    const allocations = Array.from(memberAllocations.values());
    
    allocations.forEach(allocation => {
      totalCost += allocation.cost || 0;
      totalHours += allocation.hours || 0;
      totalDays += allocation.daysEquivalent || 0;
    });
    
    return {
      totalCost: roundToOneDecimal(totalCost),
      totalHours: roundToOneDecimal(totalHours),
      totalDays: roundToOneDecimal(totalDays),
      allocations
    };
  }, []);

  return {
    handleAllocationChangeLocal,
    handleAllocationCommit,
    calculateMemberAllocations,
    calculateCostSummary
  };
} 