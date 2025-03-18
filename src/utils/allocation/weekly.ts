import { parseISO, eachWeekOfInterval, format, addDays, differenceInDays } from 'date-fns';
import { TimeAllocation, WeeklyAllocation, WeeklyAvailability, RosterMember, MemberAllocation, TeamAllocation } from '../types/allocation';
import { calculateWorkingDays } from '../time/calendar';
import { parseJsonIfString } from '@/utils/utils';
import { Node } from '@xyflow/react';

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
 * Calculates working dates and percentages for member allocations
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format (optional)
 * @param duration Duration in days (optional)
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

/**
 * Breaks down a date range into weekly buckets
 * @param startDate ISO format date string (YYYY-MM-DD)
 * @param endDate ISO format date string (YYYY-MM-DD)
 * @returns Array of weekly bucket IDs (YYYY-WW format)
 */
export function getWeeklyBuckets(startDate: string, endDate: string): string[] {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    // Get all weeks in the range
    const weeks = eachWeekOfInterval({ start, end });
    
    // Format each week as YYYY-WW
    return weeks.map((weekStart: Date) => format(weekStart, 'yyyy-ww'));
  } catch (error) {
    console.error('Error generating weekly buckets:', error);
    return [];
  }
}

/**
 * Breaks down an allocation across weekly buckets
 * @param allocation Allocation with start/end dates and hours
 * @param nodeId ID of the work node
 * @param nodeName Name of the work node
 * @returns Array of weekly allocations
 */
export function breakdownAllocationByWeek(
  allocation: TimeAllocation,
  nodeId: string,
  nodeName: string
): WeeklyAllocation[] {
  try {
    const start = parseISO(allocation.startDate);
    const end = parseISO(allocation.endDate);
    
    // Calculate total days in the allocation
    const totalDays = Math.max(1, differenceInDays(end, start) + 1);
    
    // Get all weeks in the range
    const weeks = eachWeekOfInterval({ start, end });
    
    return weeks.map((weekStart: Date) => {
      const weekEnd = addDays(weekStart, 6);
      
      // Trim to allocation boundaries
      const effectiveStart = start > weekStart ? start : weekStart;
      const effectiveEnd = end < weekEnd ? end : weekEnd;
      
      // Calculate days in this week (proportional allocation)
      const daysInWeek = Math.max(1, differenceInDays(effectiveEnd, effectiveStart) + 1);
      const weekProportion = daysInWeek / totalDays;
      
      return {
        weekId: format(weekStart, 'yyyy-ww'),
        startDate: format(effectiveStart, 'yyyy-MM-dd'),
        endDate: format(effectiveEnd, 'yyyy-MM-dd'),
        hours: allocation.weeklyHours * weekProportion,
        nodeId,
        nodeName
      };
    });
  } catch (error) {
    console.error('Error breaking down allocation by week:', error);
    return [];
  }
}

/**
 * Checks if a member is over-allocated during a specific timeframe
 * @param allocations Array of weekly allocations
 * @param memberCapacity Member's weekly capacity (based on team allocation)
 * @returns Weekly availability data with over-allocation flags
 */
export function calculateMemberWeeklyAvailability(
  allocations: WeeklyAllocation[],
  memberCapacity: number
): WeeklyAvailability[] {
  // Group allocations by week
  const weeklyAllocations = allocations.reduce<Record<string, {
    weekId: string;
    startDate: string;
    endDate: string;
    allocatedHours: number;
    allocations: Array<{
      nodeId: string;
      nodeName: string;
      hours: number;
    }>;
  }>>((acc, allocation) => {
    if (!acc[allocation.weekId]) {
      acc[allocation.weekId] = {
        weekId: allocation.weekId,
        startDate: allocation.startDate,
        endDate: allocation.endDate,
        allocatedHours: 0,
        allocations: []
      };
    }
    
    acc[allocation.weekId].allocatedHours += allocation.hours;
    acc[allocation.weekId].allocations.push({
      nodeId: allocation.nodeId,
      nodeName: allocation.nodeName,
      hours: allocation.hours
    });
    
    return acc;
  }, {});
  
  // Convert to array and calculate availability
  return Object.values(weeklyAllocations).map(week => {
    const availableHours = memberCapacity;
    const allocatedHours = week.allocatedHours;
    const overAllocated = allocatedHours > availableHours;
    
    return {
      weekId: week.weekId,
      startDate: week.startDate,
      endDate: week.endDate,
      availableHours,
      allocatedHours,
      overAllocated,
      overAllocatedBy: overAllocated ? allocatedHours - availableHours : 0,
      allocations: week.allocations
    };
  });
}

/**
 * Get member allocations across all features
 * @param memberId The member ID
 * @param allNodes All nodes in the flow
 * @returns Total hours allocated to this member across all features
 */
export function getMemberTotalAllocations(memberId: string, allNodes: Node[]): number {
  return allNodes
    .filter(node => node.type === 'feature' && node.data.teamAllocations)
    .reduce((total, node) => {
      const teamAllocations = parseJsonIfString<TeamAllocation[]>(node.data.teamAllocations, []);
      const memberAllocation = teamAllocations
        .flatMap(ta => ta.allocatedMembers || [])
        .find((m: MemberAllocation) => m.memberId === memberId);
      
      return total + (memberAllocation?.hours || 0);
    }, 0);
} 