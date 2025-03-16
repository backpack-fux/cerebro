import { calculateEffectiveCapacity } from './capacity';
import { AvailableMember } from '../types/allocation';

/**
 * Standardized utility to calculate available hours for a team member in a node context
 * This ensures consistent capacity calculations across all node types (feature, option, provider, etc.)
 * 
 * @param member The team member data
 * @param projectDurationDays The project duration in days
 * @returns The total available hours for the project duration
 */
export function calculateNodeMemberCapacity(
  member: AvailableMember,
  projectDurationDays: number
): number {
  // Ensure we're using weekly capacity, not daily
  const weeklyCapacity = member.weeklyCapacity || 
                        (member.hoursPerDay || 8) * (member.daysPerWeek || 5);
  
  // Apply team allocation percentage (default to 100% if not specified)
  const teamAllocationPercent = typeof member.allocation === 'number' ? member.allocation : 100;
  
  // Calculate total available hours for the project duration using the shared utility
  return calculateEffectiveCapacity(
    weeklyCapacity,
    teamAllocationPercent,
    projectDurationDays,
    member.daysPerWeek || 5
  );
}

/**
 * Debug utility to log capacity calculation details
 * Useful for troubleshooting capacity calculation issues
 */
export function logCapacityCalculation(
  memberName: string,
  member: AvailableMember,
  projectDurationDays: number,
  totalAvailableHours: number
): void {
  const weeklyCapacity = member.weeklyCapacity || 
                        (member.hoursPerDay || 8) * (member.daysPerWeek || 5);
  
  console.log(`[NodeCapacity] Calculation for ${memberName}:`, {
    memberId: member.memberId,
    weeklyCapacity,
    dailyCapacity: weeklyCapacity / (member.daysPerWeek || 5),
    allocation: member.allocation || 100,
    projectDurationDays,
    totalAvailableHours,
    calculationCheck: (member.allocation || 100) / 100 * (weeklyCapacity / (member.daysPerWeek || 5)) * projectDurationDays
  });
} 