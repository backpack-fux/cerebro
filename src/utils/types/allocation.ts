/**
 * Interface for member capacity data
 */
export interface MemberCapacity {
  hoursPerDay: number;
  daysPerWeek: number;
  allocation?: number; // Percentage allocation to a team (0-100)
}

/**
 * Interface for allocation calculation results
 */
export interface AllocationResult {
  hours: number;
  percentage: number;
  daysEquivalent: number;
  isOverallocated?: boolean;
  availableHours?: number;
  minimumDurationNeeded?: number;
}

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
 * Interface for team allocation data
 */
export interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: Array<MemberAllocation>;
  startDate?: string;
  endDate?: string;
}

/**
 * Interface for member allocation data
 */
export interface MemberAllocation {
  memberId: string;
  name?: string;
  hours: number;
  hoursPerDay?: number;
  startDate?: string;
  endDate?: string;
  cost?: number;
}

/**
 * Interface for team roster member data
 */
export interface RosterMember {
  memberId: string;
  allocation: number;  // % of member's time allocated to team
  allocations: Array<WorkAllocation>;
  startDate: string;
}

/**
 * Interface for work allocation data
 */
export interface WorkAllocation {
  nodeId: string;
  percentage: number;
  startDate?: string;
  endDate?: string;
  totalHours?: number;
  weeklyHours?: number;
}

/**
 * Interface for work allocation with required timeframe
 */
export interface TimeframeWorkAllocation extends WorkAllocation {
  startDate: string;
  endDate: string;
  weeklyHours: number;
}

/**
 * Interface for available member data
 */
export interface AvailableMember {
  memberId: string;
  name: string;
  availableHours: number;
  dailyRate: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
  allocation?: number; // Team allocation percentage (0-100)
}

/**
 * Interface for cost summary data
 */
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
 * Interface for team allocation with required timeframe
 */
export interface TimeframeTeamAllocation extends TeamAllocation {
  timeframe: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Interface for member allocation data
 */
export interface MemberAllocationData {
  memberId: string;
  name?: string;
  hours: number;
  percentage?: number;
  weeklyCapacity?: number;
  memberCapacity?: MemberCapacity;
  cost: number;
  isOverAllocated?: boolean;
  availableHours?: number;
  effectiveCapacity?: number;
  overAllocatedBy?: number;
  allocations?: Array<{
    nodeId: string;
    nodeName: string;
    weeklyHours: number;
    totalHours: number;
  }>;
} 