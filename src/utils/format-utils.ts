/**
 * Utility functions for formatting values for display
 */

/**
 * Format a number with appropriate precision
 * @param value The number to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string with commas and specified decimal places
 */
export function formatNumber(
  value: number | string | undefined,
  decimals: number = 2
): string {
  if (value === undefined || value === null || value === '') return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format currency value for display
 * @param value The number to format as currency
 * @param currency Currency code (default: 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | string | undefined,
  currency: string = 'USD'
): string {
  if (value === undefined || value === null || value === '') return '$0.00';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Format hours for display, converting to minutes for small values
 * @param hours The number of hours to format
 * @returns Formatted string representing the hours in a user-friendly format
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${Math.round(hours * 10) / 10} hrs`;
}

/**
 * Format days for display
 * @param days Number of days
 * @returns Formatted string
 */
export function formatDays(days: number): string {
  const roundedDays = Math.round(days * 10) / 10;
  return `${roundedDays} ${roundedDays === 1 ? 'day' : 'days'}`;
}

/**
 * Format a date for display
 * @param date Date string or Date object
 * @param format Format style (default: short)
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date | undefined,
  format: 'short' | 'medium' | 'long' = 'short'
): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: format === 'short' ? 'numeric' : format === 'medium' ? 'short' : 'long', 
    day: 'numeric' 
  };
  
  return dateObj.toLocaleDateString('en-US', options);
}

/**
 * Format a percentage for display
 * @param value Percentage value (0-100)
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${Number(value).toFixed(decimals)}%`;
} 