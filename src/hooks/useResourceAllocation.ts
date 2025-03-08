"use client";

import { useCallback } from "react";
import { 
  calculateWeeklyCapacity, 
  percentageToHours,
  MemberCapacity
} from '@/lib/utils';

// Utility function to round numbers to 1 decimal place for better display
const roundToOneDecimal = (num: number): number => {
  return Math.round(num * 10) / 10;
};

/**
 * Hook for managing resource allocations
 * Shared between feature and option nodes
 */
export function useResourceAllocation(
  data: any,
  teamAllocationHook: any,
  getNodes: () => any[]
) {
  /**
   * Handle allocation percentage change - local state only (no backend save)
   * @param memberId The ID of the member to update
   * @param percentage The allocation percentage (0-100)
   */
  const handleAllocationChangeLocal = useCallback((memberId: string, percentage: number) => {
    // Find the team for this member
    const team = teamAllocationHook.connectedTeams.find((team: any) => 
      team.availableBandwidth.some((m: any) => m.memberId === memberId)
    );
    
    if (!team) {
      console.warn(`⚠️ Could not find team for member ${memberId}`);
      return;
    }
    
    const teamId = team.teamId;
    
    // Find the team member to get their capacity details
    const teamMember = team.availableBandwidth.find((m: any) => m.memberId === memberId);
    if (!teamMember) {
      console.warn(`⚠️ Could not find team member ${memberId} in team ${teamId}`);
      return;
    }
    
    // Create a MemberCapacity object from the available data
    const memberCapacity: MemberCapacity = {
      // Use the actual values from the team member if available
      hoursPerDay: teamMember.hoursPerDay || 8,
      daysPerWeek: teamMember.daysPerWeek || 5,
      allocation: 100 // We're calculating for 100% of their capacity
    };
    
    // Calculate the project duration in days
    const duration = Number(data.duration) || 1;
    const timeUnit = data.timeUnit || 'days';
    const durationDays = timeUnit === 'weeks' ? duration * 5 : duration;
    
    // Calculate weekly capacity - use the actual weeklyCapacity if available
    const weeklyCapacity = teamMember.weeklyCapacity || calculateWeeklyCapacity(memberCapacity);
    
    // Ensure the weekly capacity is reasonable (cap at 100 hours per week)
    const normalizedWeeklyCapacity = Math.min(weeklyCapacity, 100);
    
    // Calculate hours based on percentage of capacity
    const totalHours = percentageToHours(percentage, normalizedWeeklyCapacity * (durationDays / 5));
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (teamMember.name || memberId.split('-')[0]);
    
    // Use the teamAllocationHook to update the allocation
    // This ensures that all allocations are properly preserved
    teamAllocationHook.requestTeamAllocation(
      teamId, 
      totalHours, 
      [{
        memberId,
        name: memberName,
        hours: roundToOneDecimal(totalHours)
      }]
    );
    
  }, [data.duration, data.timeUnit, getNodes, teamAllocationHook]);

  /**
   * Handle allocation commit - save to backend when the user finishes dragging
   * @param memberId The ID of the member to update
   * @param percentage The allocation percentage (0-100)
   */
  const handleAllocationCommit = useCallback((memberId: string, percentage: number) => {
    // Find the team for this member
    const team = teamAllocationHook.connectedTeams.find((team: any) => 
      team.availableBandwidth.some((m: any) => m.memberId === memberId)
    );
    
    if (!team) {
      console.warn(`⚠️ Could not find team for member ${memberId}`);
      return;
    }
    
    const teamId = team.teamId;
    
    // Find the team member to get their capacity details
    const teamMember = team.availableBandwidth.find((m: any) => m.memberId === memberId);
    if (!teamMember) {
      console.warn(`⚠️ Could not find team member ${memberId} in team ${teamId}`);
      return;
    }
    
    // Create a MemberCapacity object from the available data
    const memberCapacity: MemberCapacity = {
      // Use the actual values from the team member if available
      hoursPerDay: teamMember.hoursPerDay || 8,
      daysPerWeek: teamMember.daysPerWeek || 5,
      allocation: 100 // We're calculating for 100% of their capacity
    };
    
    // Calculate the project duration in days
    const duration = Number(data.duration) || 1;
    const timeUnit = data.timeUnit || 'days';
    const durationDays = timeUnit === 'weeks' ? duration * 5 : duration;
    
    // Calculate weekly capacity - use the actual weeklyCapacity if available
    const weeklyCapacity = teamMember.weeklyCapacity || calculateWeeklyCapacity(memberCapacity);
    
    // Ensure the weekly capacity is reasonable (cap at 100 hours per week)
    const normalizedWeeklyCapacity = Math.min(weeklyCapacity, 100);
    
    // Calculate hours based on percentage of capacity
    const totalHours = percentageToHours(percentage, normalizedWeeklyCapacity * (durationDays / 5));
    
    console.log(`🔄 Committing allocation for member ${memberId} in team ${teamId}:`, {
      percentage,
      memberCapacity,
      weeklyCapacity: normalizedWeeklyCapacity,
      durationDays,
      totalHours
    });
    
    // Get the actual team member node to get the correct name
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    const memberName = memberNode?.data?.title 
      ? String(memberNode.data.title) 
      : (teamMember.name || memberId.split('-')[0]);
    
    // Use the teamAllocationHook to update the allocation and save to backend
    // This ensures that all allocations are properly preserved
    const updatedAllocations = teamAllocationHook.requestTeamAllocation(
      teamId, 
      totalHours, 
      [{
        memberId,
        name: memberName,
        hours: roundToOneDecimal(totalHours)
      }]
    );
    
    // Save the updated allocations to backend if available
    if (updatedAllocations && teamAllocationHook.saveTeamAllocationsToBackend) {
      teamAllocationHook.saveTeamAllocationsToBackend(updatedAllocations);
    }
    
  }, [data.duration, data.timeUnit, getNodes, teamAllocationHook]);

  /**
   * Calculate member allocations for display and cost calculation
   * @param connectedTeams Array of connected teams
   * @param processedTeamAllocations Array of processed team allocations
   * @param projectDurationDays Project duration in days
   * @param formatMemberName Function to format member names
   * @returns Map of member allocations
   */
  const calculateMemberAllocations = useCallback((
    connectedTeams: any[],
    processedTeamAllocations: any[],
    projectDurationDays: number,
    formatMemberName: (memberId: string, memberData?: any) => string
  ) => {
    const allocations = new Map();
    
    // Process each team allocation
    processedTeamAllocations.forEach(allocation => {
      // Process each member in the allocation
      allocation.allocatedMembers.forEach((member: any) => {
        // Use the member's name if available, otherwise format the ID
        const memberName = member.name || formatMemberName(member.memberId);
        
        // Find the team member in the available bandwidth to get their capacity details
        const team = connectedTeams.find(t => t.teamId === allocation.teamId);
        const teamMember = team?.availableBandwidth.find((m: { memberId: string }) => m.memberId === member.memberId);
        
        // Create a MemberCapacity object from the available data
        const memberCapacity: MemberCapacity = {
          // Use the actual values from the team member if available
          hoursPerDay: teamMember?.hoursPerDay || 8,
          daysPerWeek: teamMember?.daysPerWeek || 5,
          allocation: 100 // We're calculating for 100% of their capacity
        };
        
        // Calculate weekly capacity - use the actual weeklyCapacity if available
        const weeklyCapacity = teamMember?.weeklyCapacity || calculateWeeklyCapacity(memberCapacity);
        
        // Ensure the weekly capacity is reasonable (cap at 100 hours per week)
        const normalizedWeeklyCapacity = Math.min(weeklyCapacity, 100);
        
        // Get the allocated hours for this member
        const memberHours = typeof member.hours === 'number' ? member.hours : 0;
        
        // Calculate percentage of their capacity being used
        // Total capacity = weekly capacity * (duration in days / days per week)
        const totalCapacity = normalizedWeeklyCapacity * (projectDurationDays / memberCapacity.daysPerWeek);
        const percentage = totalCapacity > 0 
          ? (memberHours / totalCapacity) * 100 
          : 0;
        
        // Calculate cost based on hourly rate
        // dailyRate in the API is actually an hourly rate
        const hourlyRate = teamMember?.dailyRate || 100; // Default hourly rate
        const cost = memberHours * hourlyRate;
        
        // Add or update the allocation for this member
        if (allocations.has(member.memberId)) {
          const current = allocations.get(member.memberId);
          const currentHours = typeof current.hours === 'number' ? current.hours : 0;
          allocations.set(member.memberId, {
            ...current,
            hours: currentHours + memberHours,
            percentage: percentage,
            weeklyCapacity: normalizedWeeklyCapacity,
            memberCapacity,
            name: memberName, // Ensure we store the name
            hourlyRate,
            cost: current.cost + cost
          });
        } else {
          allocations.set(member.memberId, {
            memberId: member.memberId,
            hours: memberHours,
            percentage: percentage,
            weeklyCapacity: normalizedWeeklyCapacity,
            memberCapacity,
            name: memberName, // Store the name
            hourlyRate,
            cost: cost
          });
        }
      });
    });
    
    return allocations;
  }, []);

  /**
   * Calculate cost summary for display
   * @param memberAllocations Map of member allocations
   * @returns Cost summary object
   */
  const calculateCostSummary = useCallback((memberAllocations: Map<string, any>) => {
    let totalCost = 0;
    let totalHours = 0;
    let totalDays = 0;
    const allocations = Array.from(memberAllocations.values());
    
    allocations.forEach(allocation => {
      totalCost += allocation.cost || 0;
      totalHours += allocation.hours || 0;
      
      // Calculate days based on hours and hoursPerDay
      const hoursPerDay = allocation.memberCapacity?.hoursPerDay || 8;
      const days = (allocation.hours || 0) / hoursPerDay;
      totalDays += days;
    });
    
    return {
      allocations: allocations.map(allocation => ({
        memberId: allocation.memberId,
        name: allocation.name,
        hours: allocation.hours,
        hourlyRate: allocation.hourlyRate,
        cost: allocation.cost
      })),
      totalCost,
      totalHours,
      totalDays
    };
  }, []);

  return {
    handleAllocationChangeLocal,
    handleAllocationCommit,
    calculateMemberAllocations,
    calculateCostSummary
  };
} 