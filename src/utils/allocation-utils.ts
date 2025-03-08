import { parseJsonIfString } from '@/lib/utils';
import { calculateWorkingDays } from './date-utils';

export interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: Array<MemberAllocation>;
  startDate?: string;
  endDate?: string;
}

export interface MemberAllocation {
  memberId: string;
  name?: string;
  hours: number;
  hoursPerDay?: number;
  startDate?: string;
  endDate?: string;
  cost?: number;
}

export interface RosterMember {
  memberId: string;
  allocation: number;  // % of member's time allocated to team
  allocations: Array<WorkAllocation>;
  startDate: string;
}

export interface WorkAllocation {
  nodeId: string;
  percentage: number;
  startDate?: string;
  endDate?: string;
  totalHours?: number;
}

export interface AvailableMember {
  memberId: string;
  name: string;
  availableHours: number;
  dailyRate: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
}

export interface CostSummary {
  dailyCost: number;
  totalCost: number;
  totalHours: number;
  totalDays: number;
  calendarDuration?: number;
  allocations: Array<{
    member: {
      memberId: string;
      name: string;
      dailyRate: number;
    };
    allocation: number;
    allocatedDays: number;
    hours: number;
    hoursPerDay?: number;
    startDate?: string;
    endDate?: string;
    cost: number;
  }>;
}

/**
 * Calculate member allocations from team roster and requested hours
 * @param roster Team roster with member allocations
 * @param requestedHours Total requested hours for the team
 * @returns Array of member allocations
 */
export function calculateMemberAllocations(
  roster: RosterMember[], 
  requestedHours: number
): MemberAllocation[] {
  return roster.map(member => {
    // Calculate hours based on allocation percentage
    const memberAllocation = member.allocation || 0;
    const hours = (memberAllocation / 100) * requestedHours;
    
    return {
      memberId: member.memberId,
      hours
    };
  });
}

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

/**
 * Calculates working dates and percentages for member allocations
 * @param feature Feature node data with duration information
 * @param member Team member data with capacity information
 * @param hours Requested hours for allocation
 * @returns Object with calculated dates, percentages and costs
 */
export function calculateMemberAllocationDetails(
  startDate: string,
  endDate: string | undefined,
  duration: number | undefined,
  member: {
    hoursPerDay: number;
    daysPerWeek: number;
    dailyRate: number;
  },
  hours: number
) {
  // Use feature dates or calculate reasonable defaults
  const featureStartDate = startDate || new Date().toISOString().split('T')[0];
  const featureDuration = duration || 10; // Default to 10 days if not specified
  
  // Calculate end date if not provided
  let featureEndDate = endDate;
  if (!featureEndDate) {
    const start = new Date(featureStartDate);
    // Add duration in business days (approximation)
    const end = new Date(start);
    end.setDate(start.getDate() + Math.ceil(featureDuration * 1.4)); // Add buffer for weekends
    featureEndDate = end.toISOString().split('T')[0];
  }

  // Calculate working days between start and end dates
  const workingDays = calculateWorkingDays(
    featureStartDate, 
    featureEndDate, 
    member.daysPerWeek
  );

  // Calculate percentage of capacity
  const memberDailyHours = hours / workingDays;
  const dailyPercentage = (memberDailyHours / member.hoursPerDay) * 100;
  const percentage = Math.min(100, dailyPercentage);

  // Calculate cost
  const daysEquivalent = hours / member.hoursPerDay;
  const cost = daysEquivalent * member.dailyRate;
  
  return {
    percentage,
    startDate: featureStartDate,
    endDate: featureEndDate,
    workingDays,
    dailyHours: memberDailyHours,
    cost
  };
} 