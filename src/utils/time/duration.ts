import { TimeUnit } from '@/types/common';

export interface DurationConfig {
  maxDays: number;
  daysPerWeek: number;
  daysPerMonth: number;
}

const DEFAULT_CONFIG: DurationConfig = {
  maxDays: 180,
  daysPerWeek: 7,
  daysPerMonth: 30
};

/**
 * Convert a duration to days based on the unit
 */
export function convertToDays(value: number, unit: TimeUnit, config: Partial<DurationConfig> = {}): number {
  const { daysPerWeek, daysPerMonth } = { ...DEFAULT_CONFIG, ...config };
  
  switch (unit) {
    case 'weeks':
      return value * daysPerWeek;
    case 'months':
      return value * daysPerMonth;
    default:
      return value;
  }
}

/**
 * Format a duration in days to a human-readable string
 */
export function formatDuration(days: number, config: Partial<DurationConfig> = {}): string {
  const { daysPerWeek, daysPerMonth } = { ...DEFAULT_CONFIG, ...config };
  
  const months = Math.floor(days / daysPerMonth);
  const remainingDays = days % daysPerMonth;
  const weeks = Math.floor(remainingDays / daysPerWeek);
  const finalDays = remainingDays % daysPerWeek;
  
  if (months === 0 && weeks === 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (months === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}${finalDays > 0 ? ` ${finalDays} day${finalDays !== 1 ? 's' : ''}` : ''}`;
  if (weeks === 0 && finalDays === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  return `${months} month${months !== 1 ? 's' : ''} ${weeks > 0 ? `${weeks} week${weeks !== 1 ? 's' : ''}` : ''}${finalDays > 0 ? ` ${finalDays} day${finalDays !== 1 ? 's' : ''}` : ''}`;
}

/**
 * Parse a duration string (e.g., "2w" or "10d") into days
 */
export function parseDurationString(value: string, config: Partial<DurationConfig> = {}): number | null {
  const { daysPerWeek, daysPerMonth } = { ...DEFAULT_CONFIG, ...config };
  
  const numericValue = value.toLowerCase().replace(/[wmd]/, '');
  const isWeeks = value.toLowerCase().includes('w');
  const isMonths = value.toLowerCase().includes('m');
  const number = parseFloat(numericValue);

  if (isNaN(number)) return null;

  if (isMonths) return number * daysPerMonth;
  if (isWeeks) return number * daysPerWeek;
  return number;
}

/**
 * Calculate end date based on start date and duration
 */
export function calculateEndDate(startDate: Date, durationDays: number): Date {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + durationDays);
  return endDate;
}

/**
 * Calculate duration between two dates in days
 */
export function calculateDurationBetweenDates(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Validate if a duration is within allowed limits
 */
export function isValidDuration(days: number, config: Partial<DurationConfig> = {}): boolean {
  const { maxDays } = { ...DEFAULT_CONFIG, ...config };
  return days >= 0 && days <= maxDays;
} 