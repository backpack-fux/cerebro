import { MemberCapacity, AllocationResult } from '../types/allocation';

/**
 * Calculate a member's effective capacity based on their weekly capacity and team allocation
 * @param memberWeeklyCapacity The member's total weekly capacity in hours
 * @param teamAllocationPercentage The percentage of the member's time allocated to the team (0-100)
 * @param projectDurationDays Optional project duration in calendar days
 * @param memberDaysPerWeek Optional member's working days per week (defaults to 5)
 * @returns The effective capacity in hours
 */
export function calculateEffectiveCapacity(
  memberWeeklyCapacity: number,
  teamAllocationPercentage: number,
  projectDurationDays?: number,
  memberDaysPerWeek: number = 5
): number {
  // Calculate daily hours based on member's weekly capacity
  const dailyHours = memberWeeklyCapacity / memberDaysPerWeek;
  
  // Apply team allocation percentage
  const effectiveDailyHours = (teamAllocationPercentage / 100) * dailyHours;
  
  // If project duration is provided, calculate total available hours
  if (projectDurationDays !== undefined) {
    return effectiveDailyHours * projectDurationDays;
  }
  
  // Otherwise return weekly effective capacity
  return effectiveDailyHours * memberDaysPerWeek;
}

/**
 * Calculates weekly hours based on total hours and duration
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
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate total days and weeks
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalWeeks = totalDays / 7;
    
    // Return hours per week
    return totalHours / totalWeeks;
  } catch (error) {
    console.error('Error calculating weekly hours:', error);
    return 0;
  }
}

/**
 * Calculate a team member's weekly capacity in hours
 */
export function calculateWeeklyCapacity(member: MemberCapacity): number {
  const hoursPerDay = member.hoursPerDay || 8;
  const daysPerWeek = member.daysPerWeek || 5;
  return hoursPerDay * daysPerWeek;
}

/**
 * Convert hours to percentage of capacity
 * @param hours The hours to convert
 * @param capacity The total capacity in hours
 * @returns Percentage (0-100)
 */
export function hoursToPercentage(hours: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, (hours / capacity) * 100);
}

/**
 * Convert percentage to hours
 * @param percentage The percentage to convert (0-100)
 * @param capacity The total capacity in hours
 * @returns Hours
 */
export function percentageToHours(percentage: number, capacity: number): number {
  return (Math.min(100, Math.max(0, percentage)) / 100) * capacity;
}

/**
 * Calculate the total available hours for a member during a feature's duration
 * @param duration The feature duration in days
 * @param memberCapacity The member's capacity information
 * @param existingAllocations Optional array of existing allocations in hours
 * @returns Available hours during the feature duration
 */
export function calculateAvailableHours(
  duration: number,
  memberCapacity: MemberCapacity,
  existingAllocations: number = 0
): number {
  const hoursPerDay = memberCapacity.hoursPerDay || 8;
  const totalDurationHours = hoursPerDay * duration;
  return Math.max(0, totalDurationHours - existingAllocations);
}

/**
 * Calculate the minimum duration needed to complete work given member availability
 * @param requestedHours The hours requested for the feature
 * @param memberCapacity The member's capacity information
 * @param existingAllocations Optional array of existing allocations in hours
 * @returns Minimum duration in days needed
 */
export function calculateMinimumDuration(
  requestedHours: number,
  memberCapacity: MemberCapacity,
  existingAllocations: number = 0
): number {
  const hoursPerDay = memberCapacity.hoursPerDay || 8;
  const availableHoursPerDay = Math.max(0, hoursPerDay - (existingAllocations / hoursPerDay));
  
  if (availableHoursPerDay <= 0) {
    return Infinity; // Member has no availability
  }
  
  return Math.ceil(requestedHours / availableHoursPerDay);
}

/**
 * Calculate allocation for a feature with a specific duration
 * @param hours The hours allocated
 * @param duration The duration in days
 * @param memberCapacity The member's capacity information
 * @param existingAllocations Optional existing allocations in hours
 * @returns Allocation result with hours, percentage, days equivalent, and overallocation status
 */
export function calculateFeatureAllocation(
  hours: number, 
  duration: number, 
  memberCapacity: MemberCapacity,
  existingAllocations: number = 0
): AllocationResult {
  const hoursPerDay = memberCapacity.hoursPerDay || 8;
  const totalDurationHours = hoursPerDay * duration;
  const availableHours = calculateAvailableHours(duration, memberCapacity, existingAllocations);
  const isOverallocated = hours > availableHours;
  const minimumDurationNeeded = calculateMinimumDuration(hours, memberCapacity, existingAllocations);
  
  return {
    hours,
    percentage: hoursToPercentage(hours, totalDurationHours),
    daysEquivalent: hours / hoursPerDay,
    isOverallocated,
    availableHours,
    minimumDurationNeeded
  };
}

/**
 * Calculate total team bandwidth
 * @param members Array of team members with their capacity information
 * @returns Total bandwidth in hours per week
 */
export function calculateTeamBandwidth(members: MemberCapacity[]): number {
  return members.reduce((total, member) => {
    const weeklyCapacity = calculateWeeklyCapacity(member);
    const allocation = typeof member.allocation === 'number' ? member.allocation : 100;
    return total + calculateEffectiveCapacity(weeklyCapacity, allocation);
  }, 0);
} 