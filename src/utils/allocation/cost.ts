import { TeamAllocation, MemberAllocation, AvailableMember, CostSummary } from '../types/allocation';

/**
 * Calculate cost summary for team allocations
 * @param teamAllocations Team allocations array
 * @param availableMembers Available members with rates and capacity
 * @returns Cost summary object
 */
export function calculateCostSummary(
  teamAllocations: TeamAllocation[],
  availableMembers: Record<string, AvailableMember> // Indexed by memberId
): CostSummary {
  // Start with empty cost summary
  const costSummary: CostSummary = {
    dailyCost: 0,
    totalCost: 0,
    totalHours: 0,
    totalDays: 0,
    allocations: [],
  };
  
  // If no team allocations, return empty cost summary
  if (!teamAllocations || teamAllocations.length === 0) {
    return costSummary;
  }
  
  // Calculate costs for each team allocation
  teamAllocations.forEach(allocation => {
    // Calculate costs for each allocated member
    allocation.allocatedMembers.forEach((member: MemberAllocation) => {
      // Find the member in available members
      const teamMember = availableMembers[member.memberId];
      if (!teamMember) return;
      
      // Calculate allocated days and cost
      const hoursPerDay = member.hoursPerDay || teamMember.hoursPerDay || 8; // Default to 8 hours per day
      const allocatedDays = member.hours / hoursPerDay;
      const cost = allocatedDays * teamMember.dailyRate;
      
      // Add to cost summary
      costSummary.allocations.push({
        member: {
          memberId: member.memberId,
          name: teamMember.name,
          dailyRate: teamMember.dailyRate,
        },
        allocation: (member.hours / teamMember.availableHours) * 100,
        allocatedDays,
        hours: member.hours,
        hoursPerDay,
        startDate: member.startDate,
        endDate: member.endDate,
        cost,
      });
      
      // Update totals
      costSummary.totalCost += cost;
      costSummary.totalHours += member.hours;
      costSummary.totalDays += allocatedDays;
    });
  });
  
  // Calculate daily cost
  costSummary.dailyCost = costSummary.totalDays > 0 ? costSummary.totalCost / costSummary.totalDays : 0;
  
  return costSummary;
} 