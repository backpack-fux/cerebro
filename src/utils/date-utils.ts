/**
 * Utility functions for handling date and duration calculations
 */

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
 * Calculate the calendar duration from a collection of allocations with start and end dates
 * @param allocations Array of objects containing startDate and endDate
 * @returns Number of calendar days between earliest start and latest end date
 */
export function calculateCalendarDuration(
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