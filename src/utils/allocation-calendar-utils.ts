import { parseISO, eachWeekOfInterval, format, addDays, differenceInDays, startOfWeek } from 'date-fns';

/**
 * Interface for time-based allocation data
 */
export interface TimeAllocation {
  startDate: string;
  endDate: string;
  weeklyHours: number;
}

/**
 * Interface representing a weekly allocation bucket
 */
export interface WeeklyAllocation {
  weekId: string; // Format: YYYY-WW (e.g., 2025-01)
  startDate: string;
  endDate: string;
  hours: number;
  nodeId: string;
  nodeName: string;
}

/**
 * Interface for member availability per week
 */
export interface WeeklyAvailability {
  weekId: string;
  startDate: string;
  endDate: string;
  availableHours: number;
  allocatedHours: number;
  overAllocated: boolean;
  overAllocatedBy: number;
  allocations: Array<{
    nodeId: string;
    nodeName: string;
    hours: number;
  }>;
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
 * Calculates a member's weekly hours based on total hours and duration
 * @param totalHours Total hours allocated
 * @param startDate Start date of the allocation
 * @param endDate End date of the allocation
 * @returns Hours per week
 */
export function calculateWeeklyHours(
  totalHours: number,
  startDate: string,
  endDate: string
): number {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    // Calculate total days and weeks
    const totalDays = Math.max(1, differenceInDays(end, start) + 1);
    const totalWeeks = totalDays / 7;
    
    // Return hours per week
    return totalHours / totalWeeks;
  } catch (error) {
    console.error('Error calculating weekly hours:', error);
    return 0;
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
  const weeklyAllocations = allocations.reduce((acc, allocation) => {
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
  }, {} as Record<string, any>);
  
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
 * Gets default start and end dates based on team season
 * @param season Team season data
 * @returns Default start and end dates for new allocations
 */
export function getDefaultTimeframe(season: any): { startDate: string; endDate: string } {
  // Check if season has valid startDate and endDate strings
  if (season && typeof season.startDate === 'string' && typeof season.endDate === 'string') {
    return {
      startDate: season.startDate,
      endDate: season.endDate
    };
  }
  
  // Default to current date + 30 days if no season or invalid dates
  const now = new Date();
  return {
    startDate: format(now, 'yyyy-MM-dd'),
    endDate: format(addDays(now, 30), 'yyyy-MM-dd')
  };
} 