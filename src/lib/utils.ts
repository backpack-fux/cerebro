import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Types for allocation calculations
 */
export interface MemberCapacity {
  hoursPerDay: number;
  daysPerWeek: number;
  allocation?: number; // Percentage allocation to a team (0-100)
}

export interface AllocationResult {
  hours: number;
  percentage: number;
  daysEquivalent: number;
  isOverallocated?: boolean;
  availableHours?: number;
  minimumDurationNeeded?: number;
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
 * Calculate a team member's effective capacity for a team based on their allocation percentage
 */
export function calculateEffectiveCapacity(member: MemberCapacity): number {
  const weeklyCapacity = calculateWeeklyCapacity(member);
  const allocation = typeof member.allocation === 'number' ? member.allocation : 100;
  return (weeklyCapacity * allocation) / 100;
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
    return total + calculateEffectiveCapacity(member);
  }, 0);
}

/**
 * Format hours for display, with appropriate units
 * @param hours Number of hours
 * @returns Formatted string (e.g., "40 hours" or "1 hour")
 */
export function formatHours(hours: number): string {
  const roundedHours = Math.round(hours * 10) / 10;
  return `${roundedHours} ${roundedHours === 1 ? 'hour' : 'hours'}`;
}

/**
 * Format percentage for display
 * @param percentage Percentage value
 * @returns Formatted string (e.g., "85%")
 */
export function formatPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

/**
 * Format days for display
 * @param days Number of days
 * @returns Formatted string (e.g., "5 days" or "1 day")
 */
export function formatDays(days: number): string {
  const roundedDays = Math.round(days * 10) / 10;
  return `${roundedDays} ${roundedDays === 1 ? 'day' : 'days'}`;
}

/**
 * Parse team allocations safely
 * @param teamAllocations The team allocations data which might be a string or array
 * @returns Array of team allocations
 */
export function parseTeamAllocations(teamAllocations: any): any[] {
  console.log('🔍 parseTeamAllocations called with:', { 
    teamAllocations, 
    type: typeof teamAllocations,
    isArray: Array.isArray(teamAllocations)
  });
  
  // If it's already an array, return it directly
  if (Array.isArray(teamAllocations)) {
    console.log('✅ parseTeamAllocations: Input is already an array', {
      length: teamAllocations.length
    });
    return teamAllocations;
  }
  
  // If it's a string, try to parse it
  if (typeof teamAllocations === 'string') {
    try {
      const parsed = JSON.parse(teamAllocations);
      if (Array.isArray(parsed)) {
        console.log('✅ parseTeamAllocations: Successfully parsed string to array', {
          length: parsed.length
        });
        return parsed;
      } else {
        console.warn('⚠️ parseTeamAllocations: Parsed result is not an array', {
          parsed,
          type: typeof parsed
        });
        return [];
      }
    } catch (e) {
      console.warn('❌ parseTeamAllocations: Failed to parse string', {
        error: e,
        teamAllocations
      });
      return [];
    }
  }
  
  // If it's undefined, return an empty array
  if (teamAllocations === undefined) {
    console.log('ℹ️ parseTeamAllocations: Input is undefined, returning empty array');
    return [];
  }
  
  // For any other type, log a warning and return an empty array
  console.warn('⚠️ parseTeamAllocations: Input is neither an array nor a string', {
    teamAllocations,
    type: typeof teamAllocations
  });
  return [];
}

/**
 * Get member allocations across all features
 * @param memberId The member ID
 * @param allNodes All nodes in the flow
 * @returns Total hours allocated to this member across all features
 */
export function getMemberTotalAllocations(memberId: string, allNodes: any[]): number {
  return allNodes
    .filter(node => node.type === 'feature' && node.data.teamAllocations)
    .reduce((total, node) => {
      const teamAllocations = parseTeamAllocations(node.data.teamAllocations);
      const memberAllocation = teamAllocations
        .flatMap(ta => ta.allocatedMembers || [])
        .find((m: any) => m.memberId === memberId);
      
      return total + (memberAllocation?.hours || 0);
    }, 0);
}

/**
 * Prepares data for backend storage by converting complex objects to JSON strings
 * @param data The data object to prepare
 * @param jsonFields Array of field names that should be stringified if they are objects
 * @returns A new object with complex fields stringified for backend storage
 */
export function prepareDataForBackend<T extends Record<string, any>>(
  data: Partial<T>,
  jsonFields: string[]
): Record<string, any> {
  // Create a copy of the data
  const apiData: Record<string, any> = { ...data };
  
  // Process each JSON field
  for (const field of jsonFields) {
    if (apiData[field] !== undefined && typeof apiData[field] !== 'string') {
      try {
        // Only stringify if it's not already a string
        apiData[field] = JSON.stringify(apiData[field]);
        console.log(`[prepareDataForBackend] Stringified ${field}:`, apiData[field]);
      } catch (error) {
        console.error(`[prepareDataForBackend] Error stringifying ${field}:`, error);
        // Keep the original value if stringification fails
      }
    }
  }
  
  return apiData;
}

/**
 * Parses JSON fields in data received from the backend
 * @param data The data object from the backend
 * @param jsonFields Array of field names that should be parsed if they are strings
 * @returns A new object with string fields parsed into objects
 */
export function parseDataFromBackend<T extends Record<string, any>>(
  data: Partial<T>,
  jsonFields: string[]
): Record<string, any> {
  // Create a copy of the data
  const parsedData: Record<string, any> = { ...data };
  
  // Process each JSON field
  for (const field of jsonFields) {
    if (typeof parsedData[field] === 'string') {
      try {
        parsedData[field] = JSON.parse(parsedData[field] as string);
        console.log(`[parseDataFromBackend] Parsed ${field}:`, parsedData[field]);
      } catch (error) {
        console.error(`[parseDataFromBackend] Error parsing ${field}:`, error);
        // Set to empty array if parsing fails
        parsedData[field] = [];
      }
    }
  }
  
  return parsedData;
}

/**
 * Parse JSON data if it's a string, or return the original value if it's already parsed
 * @param value The value to parse
 * @param defaultValue Default value to return if parsing fails
 */
export function parseJsonIfString<T>(value: unknown, defaultValue: T): T {
  if (typeof value !== 'string') {
    return Array.isArray(value) || typeof value === 'object' 
      ? value as T 
      : defaultValue;
  }
  
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    return defaultValue;
  }
}
