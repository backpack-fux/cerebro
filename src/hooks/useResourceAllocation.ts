"use client";

import { useCallback } from "react";
import { calculateWeeklyCapacity } from '@/utils/utils';
import { calculateEffectiveCapacity } from '@/utils/allocation/capacity';
import { ConnectedTeam } from '@/hooks/useTeamAllocation';
import { AvailableMember, TeamAllocation as GlobalTeamAllocation } from '@/utils/types/allocation';
import { useMemberAllocationPublishing, NodeDataWithTeamAllocations } from '@/hooks/useMemberAllocationPublishing';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { NodeUpdateMetadata } from '@/services/graph/observer/node-observer';

// Define interfaces for our data structures
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
  teamAllocations?: GlobalTeamAllocation[];
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
  ) => GlobalTeamAllocation[] | undefined;
  saveTeamAllocationsToBackend?: (allocations: GlobalTeamAllocation[]) => Promise<boolean>;
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
  nodeId: string,
  nodeType: NodeType,
  data: NodeData,
  teamAllocationHook: TeamAllocationHook,
  getNodes: () => Array<{ id: string; data?: { title?: string } }>,
  publishFn?: (data: NodeData, fields: string[], metadata?: Partial<NodeUpdateMetadata>) => void
) {
  // Use the standardized member allocation publishing hook
  const allocationPublishing = useMemberAllocationPublishing(
    nodeId,
    nodeType,
    data as NodeDataWithTeamAllocations,
    publishFn as (
      data: NodeDataWithTeamAllocations, 
      fields: string[], 
      metadata?: Partial<NodeUpdateMetadata>
    ) => void,
    {
      fieldName: 'teamAllocations',
      debugName: `${nodeType}Node`
    }
  );
  
  /**
   * Handle allocation change - local state only (no backend save)
   * Original implementation - will be wrapped by the publishing hook
   * @param teamId The ID of the team
   * @param memberId The ID of the member to update
   * @param hours The allocation hours
   */
  const handleAllocationChangeInternal = useCallback((teamId: string, memberId: string, hours: number) => {
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
   * Original implementation - will be wrapped by the publishing hook
   * @param memberId The ID of the member to update
   * @param hours The allocation hours
   */
  const handleAllocationCommitInternal = useCallback((teamId: string, memberId: string, hours: number) => {
    // Find the team member in the team allocation
    const team = teamAllocationHook.connectedTeams.find((t: ConnectedTeam) => t.teamId === teamId);
    if (!team) {
      console.warn(`[ResourceAllocation][${nodeId}] ⚠️ Could not find team ${teamId}`);
      return;
    }
    
    const teamMember = team.availableBandwidth.find((m: AvailableMember) => m.memberId === memberId);
    if (!teamMember) {
      console.warn(`[ResourceAllocation][${nodeId}] ⚠️ Could not find team member ${memberId} in team ${teamId}`);
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
    
    // Use the teamAllocationHook to update the allocation
    const updatedAllocations = teamAllocationHook.requestTeamAllocation(
      teamId, 
      roundedHours, 
      [{
        memberId,
        name: memberName,
        hours: roundedHours
      }],
      // Always save directly to make the implementation consistent between node types
      true
    );

    // Provider nodes need special handling to ensure allocations are saved properly
    // Explicit call to saveTeamAllocationsToBackend for reliability
    if (nodeType === 'provider' && teamAllocationHook.saveTeamAllocationsToBackend && updatedAllocations) {
      console.log(`[ResourceAllocation][${nodeId}][${nodeType}] 🔍 Provider node explicit save`);
      
      // Use setTimeout to ensure this happens after the current execution cycle
      setTimeout(() => {
        teamAllocationHook.saveTeamAllocationsToBackend!(updatedAllocations)
          .then(success => {
            if (!success) {
              console.error(`[ResourceAllocation][${nodeId}][${nodeType}] ❌ Provider explicit save failed`);
            }
          })
          .catch(error => {
            console.error(`[ResourceAllocation][${nodeId}][${nodeType}] 🚨 Error during provider explicit save:`, error);
          });
      }, 50);
    }
    // For other node types, call the save function if available
    else if (teamAllocationHook.saveTeamAllocationsToBackend && updatedAllocations) {
      teamAllocationHook.saveTeamAllocationsToBackend(updatedAllocations)
        .catch(error => {
          console.error(`[ResourceAllocation][${nodeId}][${nodeType}] 🚨 Error during explicit save:`, error);
        });
    }

    // Update is handled by the standardized allocation publishing hook
    // through the teamAllocationHook's request function that calls saveToBackendAsync
  }, [teamAllocationHook, getNodes, nodeId, nodeType]);
  
  // Use the standardized hooks to prevent circular updates
  const handleAllocationChangeLocal = useCallback((teamId: string, memberId: string, hours: number) => {
    allocationPublishing.handleAllocationChange(teamId, memberId, hours, handleAllocationChangeInternal);
  }, [allocationPublishing, handleAllocationChangeInternal]);
  
  const handleAllocationCommit = useCallback((teamId: string, memberId: string, hours: number) => {
    allocationPublishing.handleAllocationCommit(teamId, memberId, hours, handleAllocationCommitInternal);
  }, [allocationPublishing, handleAllocationCommitInternal]);

  /**
   * Handle allocation commit and return a Promise - for imperative usage
   * @param teamId The ID of the team
   * @param memberId The ID of the member
   * @param hours The allocation hours
   * @returns Promise that resolves when the commit is complete
   */
  const handleAllocationCommitAsync = useCallback(async (teamId: string, memberId: string, hours: number): Promise<boolean> => {
    // Skip if we're in the middle of an update
    if (allocationPublishing.isUpdating.current) {
      return false;
    }

    // Check if update is too recent
    if (allocationPublishing.isUpdateTooRecent(`commit_${teamId}_${memberId}`)) {
      return false;
    }

    // Set updating flag to prevent circular updates
    allocationPublishing.isUpdating.current = true;
    
    // Call the internal handler to update local state
    handleAllocationCommitInternal(teamId, memberId, hours);
    
    // Reset the updating flag after a delay
    setTimeout(() => {
      allocationPublishing.isUpdating.current = false;
    }, 150);
    
    return true;
  }, [allocationPublishing, handleAllocationCommitInternal]);

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
    processedTeamAllocations: GlobalTeamAllocation[],
    projectDurationDays: number,
    formatMemberName: (memberId: string, memberData?: { title?: string }) => string
  ) => {
    const allocations = new Map<string, MemberAllocationData>();
    
    processedTeamAllocations.forEach(allocation => {
      allocation.allocatedMembers.forEach(member => {
        const memberName = member.name || formatMemberName(member.memberId);
        const team = connectedTeams.find(t => t.teamId === allocation.teamId);
        const teamMember = team?.availableBandwidth.find(m => m.memberId === member.memberId) as ExtendedAvailableMember | undefined;
        
        if (!teamMember) {
          console.warn(`[ResourceAllocation][${nodeId}] Could not find team member ${member.memberId} in team ${allocation.teamId}`);
          return;
        }
        
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
        
        // Calculate cost: hours * hourlyRate
        const newHours = currentHours + member.hours;
        const hourlyRate = teamMember.hourlyRate || teamMember.dailyRate || 0; // Take hourlyRate directly or dailyRate as fallback
        const newCost = currentCost + (member.hours * hourlyRate);
        
        allocations.set(member.memberId, {
          memberId: member.memberId,
          name: memberName,
          hours: newHours,
          cost: newCost,
          capacity,
          allocation: teamMember.allocation || 100,
          daysEquivalent: newHours / (teamMember.hoursPerDay || 8),
          percentage: (newHours / effectiveCapacity) * 100,
          hourlyRate
        });
      });
    });
    
    return allocations;
  }, [nodeId]);

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
      const memberHours = allocation.hours || 0;
      const memberHourlyRate = allocation.hourlyRate || 0;
      const memberCost = memberHours * memberHourlyRate;
      
      totalCost += memberCost;
      totalHours += memberHours;
      totalDays += allocation.daysEquivalent || 0;
    });
    
    const result = {
      totalCost: roundToOneDecimal(totalCost),
      totalHours: roundToOneDecimal(totalHours),
      totalDays: roundToOneDecimal(totalDays),
      allocations
    };
    
    return result;
  }, []);

  return {
    handleAllocationChangeLocal,
    handleAllocationCommit,
    handleAllocationCommitAsync,
    calculateMemberAllocations,
    calculateCostSummary,
    shouldProcessUpdate: allocationPublishing.shouldProcessUpdate
  };
} 