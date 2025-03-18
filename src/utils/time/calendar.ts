import { format, addDays } from 'date-fns';

// Use a consistent date for the application
// This allows us to test with future dates
export function getCurrentDate(): Date {
  return new Date();
}

/**
 * Calculate the duration between two dates in calendar days
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns Duration in days
 */
export function calculateCalendarDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate the difference in milliseconds
  const diffTime = Math.abs(end.getTime() - start.getTime());
  
  // Convert to days and add 1 to include both start and end dates
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Calculate the calendar duration from a collection of allocations with start and end dates
 * @param allocations Array of objects containing startDate and endDate
 * @returns Number of calendar days between earliest start and latest end date
 */
export function calculateAllocationsDuration(
  allocations: Array<{ startDate?: string; endDate?: string }>
): number | undefined {
  // Filter allocations that have both start and end dates
  const validAllocations = allocations.filter(a => a.startDate && a.endDate);
  
  if (validAllocations.length === 0) {
    return undefined;
  }
  
  // Convert to Date objects
  const dates = validAllocations.map(a => ({
    start: new Date(a.startDate!),
    end: new Date(a.endDate!),
  }));
  
  // Find earliest start date and latest end date
  const minDate = new Date(Math.min(...dates.map(d => d.start.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.end.getTime())));
  
  // Calculate difference in days
  const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the number of working days between two dates based on days per week
 * @param startDate ISO Date string (YYYY-MM-DD)
 * @param endDate ISO Date string (YYYY-MM-DD)
 * @param daysPerWeek Number of working days per week (default: 5)
 * @returns Number of working days
 */
export function calculateWorkingDays(
  startDate: string, 
  endDate: string, 
  daysPerWeek: number = 5
): number {
  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate total calendar days
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate working days based on days per week ratio
  // This is a simple approximation for business days
  return Math.round(totalDays * (daysPerWeek / 7));
}

/**
 * Get an end date by adding business days to a start date
 * @param startDate ISO Date string (YYYY-MM-DD)
 * @param durationDays Number of business days to add
 * @param daysPerWeek Number of working days per week (default: 5)
 * @returns ISO Date string (YYYY-MM-DD)
 */
export function getEndDateFromDuration(
  startDate: string,
  durationDays: number,
  daysPerWeek: number = 5
): string {
  // Calculate calendar days to add (accounting for weekends)
  const calendarDaysToAdd = Math.ceil(durationDays * (7 / daysPerWeek));
  
  // Add days to the start date
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + calendarDaysToAdd);
  
  // Return ISO date string (YYYY-MM-DD)
  return end.toISOString().split('T')[0];
}

/**
 * Check if two time periods overlap
 * @param startDate1 Start date of first period in YYYY-MM-DD format
 * @param endDate1 End date of first period in YYYY-MM-DD format
 * @param startDate2 Start date of second period in YYYY-MM-DD format
 * @param endDate2 End date of second period in YYYY-MM-DD format
 * @returns True if the periods overlap, false otherwise
 */
export function doTimePeriodsOverlap(
  startDate1: string, 
  endDate1: string, 
  startDate2: string, 
  endDate2: string
): boolean {
  const start1 = new Date(startDate1);
  const end1 = new Date(endDate1);
  const start2 = new Date(startDate2);
  const end2 = new Date(endDate2);
  
  // Check if one period starts after the other ends
  if (start1 > end2 || start2 > end1) {
    return false;
  }
  
  return true;
}

/**
 * Get default timeframe for allocations, using season if available
 * @param season Optional season data with startDate and endDate
 * @returns Default start and end dates for new allocations
 */
export function getDefaultTimeframe(season: { startDate?: string; endDate?: string } | null | undefined): { startDate: string; endDate: string } {
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