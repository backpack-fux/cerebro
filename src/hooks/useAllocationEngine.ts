import { useMemo, useCallback, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { getWeeklyBuckets } from '@/utils/allocation/weekly';
import { calculateEffectiveCapacity, calculateWeeklyHours } from '@/utils/allocation/capacity';
import { calculateCalendarDuration, doTimePeriodsOverlap, getDefaultTimeframe } from '@/utils/time/calendar';
import { parseJsonIfString } from '@/utils/utils';
import { format } from 'date-fns';

/**
 * Interface for member allocation data returned by the engine
 */
export interface MemberAllocationData {
  memberId: string;
  name: string;
  weeklyCapacity: number;
  teamAllocation: number;
  effectiveCapacity: number;
  daysPerWeek: number;
  allocations: {
    nodeId: string;
    nodeName: string;
    startDate: string;
    endDate: string;
    weeklyHours: number;
    totalHours: number;
  }[];
  isOverAllocated: boolean;
}

/**
 * Hook for managing team allocations with time-based constraints
 */
export function useAllocationEngine() {
  const { getNodes } = useReactFlow();
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Force a refresh of allocation data
  const refreshAllocations = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);
  
  // Get team members
  const teamMembers = useMemo(() => {
    const teamMemberNodes = getNodes().filter(node => node.type === 'teamMember');
    const members = [];
    
    for (const node of teamMemberNodes) {
      if (!node.data) continue;
      
      const id = node.id;
      const teamId = node.data.teamId;
      
      if (!id || !teamId) continue;
      
      const title = typeof node.data.title === 'string' ? node.data.title : String(id).substring(0, 8);
      const hoursPerDay = Number(node.data.hoursPerDay) || 8;
      const daysPerWeek = Number(node.data.daysPerWeek) || 5;
      const weeklyCapacity = Number(node.data.weeklyCapacity) || hoursPerDay * daysPerWeek;
      const allocation = Number(node.data.allocation) || 100;
      
      // Calculate effective capacity based on team allocation percentage
      const effectiveCapacity = weeklyCapacity * allocation / 100;
      
      members.push({
        id,
        name: title,
        teamId,
        hoursPerDay,
        daysPerWeek,
        weeklyCapacity,
        teamAllocation: allocation,
        effectiveCapacity
      });
    }
    
    return members;
  }, [getNodes, refreshCounter]);
  
  // Get work nodes with allocation data
  const workNodesWithAllocations = useMemo(() => {
    const workNodes = getNodes().filter(node => 
      ['feature', 'option', 'provider'].includes(node.type || '')
    );
    
    return workNodes.map(node => {
      // Get team allocations
      const teamAllocations = parseJsonIfString(node.data?.teamAllocations, []);
      
      // Get timeframe
      const startDate = node.data?.startDate as string | undefined;
      const endDate = node.data?.endDate as string | undefined;
      
      // Fix the format function call to ensure it always receives a string
      const now = new Date();
      const defaultStartDate = format(now, 'yyyy-MM-dd');
      const defaultEndDate = format(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      // Get default timeframe if not specified
      let timeframe: { startDate: string; endDate: string };
      if (typeof startDate === 'string' && typeof endDate === 'string') {
        timeframe = { startDate, endDate };
      } else {
        // Find a team node for season dates
        const teamNodes = getNodes().filter(n => n.type === 'team');
        if (teamNodes.length > 0 && teamNodes[0].data?.season) {
          const season = parseJsonIfString(teamNodes[0].data.season, { 
            startDate: defaultStartDate,
            endDate: defaultEndDate
          });
          timeframe = getDefaultTimeframe(season);
        } else {
          timeframe = getDefaultTimeframe({
            startDate: defaultStartDate,
            endDate: defaultEndDate
          });
        }
      }
      
      return {
        id: node.id,
        type: node.type,
        title: typeof node.data?.title === 'string' ? node.data.title : node.id.substring(0, 8),
        teamAllocations,
        timeframe
      };
    });
  }, [getNodes, refreshCounter]);
  
  // Check if a member is over-allocated
  const checkMemberAllocation = useCallback((
    memberId: string,
    allocations: Array<{
      startDate: string;
      endDate: string;
      weeklyHours: number;
    }>
  ) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return { isOverAllocated: false };
    
    // Group allocations by week
    const weeklyAllocations: Record<string, number> = {};
    
    allocations.forEach(allocation => {
      const weeks = getWeeklyBuckets(allocation.startDate, allocation.endDate);
      weeks.forEach(weekId => {
        weeklyAllocations[weekId] = (weeklyAllocations[weekId] || 0) + allocation.weeklyHours;
      });
    });
    
    // Check if any week is over-allocated
    let isOverAllocated = false;
    const effectiveCapacity = member.effectiveCapacity;
    
    Object.values(weeklyAllocations).forEach(hours => {
      if (hours > effectiveCapacity) {
        isOverAllocated = true;
      }
    });
    
    return { isOverAllocated };
  }, [teamMembers]);
  
  // Calculate member allocations
  const memberAllocations = useMemo(() => {
    const result: Record<string, MemberAllocationData> = {};
    
    // Initialize allocation data for each member
    teamMembers.forEach(member => {
      result[member.id] = {
        memberId: member.id,
        name: member.name,
        weeklyCapacity: member.weeklyCapacity,
        teamAllocation: member.teamAllocation,
        effectiveCapacity: member.effectiveCapacity,
        daysPerWeek: member.daysPerWeek || 5,
        allocations: [],
        isOverAllocated: false
      };
    });
    
    // Process work node allocations
    workNodesWithAllocations.forEach(workNode => {
      const { id: nodeId, title: nodeName, teamAllocations, timeframe } = workNode;
      
      if (!timeframe) return;
      
      // Process each team allocation
      teamAllocations.forEach((teamAllocation: any) => {
        if (!teamAllocation?.allocatedMembers) return;
        
        // Process each member allocation
        teamAllocation.allocatedMembers.forEach((memberAlloc: any) => {
          const { memberId, name, hours = 0 } = memberAlloc;
          if (!memberId || !hours) return;
          
          // Skip if member not found
          if (!result[memberId]) return;
          
          // Calculate weekly hours
          const weeklyHours = calculateWeeklyHours(
            hours,
            timeframe.startDate,
            timeframe.endDate
          );
          
          // Add allocation with proper string typing
          result[memberId].allocations.push({
            nodeId: String(nodeId),
            nodeName: String(nodeName),
            startDate: String(timeframe.startDate),
            endDate: String(timeframe.endDate),
            weeklyHours,
            totalHours: hours
          });
        });
      });
    });
    
    // Check for over-allocation
    Object.values(result).forEach(memberData => {
      if (memberData.allocations.length > 0) {
        const { isOverAllocated } = checkMemberAllocation(
          memberData.memberId,
          memberData.allocations.map(a => ({
            startDate: a.startDate,
            endDate: a.endDate,
            weeklyHours: a.weeklyHours
          }))
        );
        memberData.isOverAllocated = isOverAllocated;
      }
    });
    
    return result;
  }, [teamMembers, workNodesWithAllocations, checkMemberAllocation]);
  
  // Check if a member is available for the given time period
  const checkMemberAvailability = useCallback((
    memberId: string,
    startDate: string,
    endDate: string,
    excludeHours: number = 0
  ): { available: boolean; availableHours: number; overAllocatedBy: number } => {
    // Get the member's allocations
    const memberData = memberAllocations[memberId];
    if (!memberData) {
      return { available: true, availableHours: 40, overAllocatedBy: 0 };
    }

    // Get the member's weekly capacity
    const weeklyCapacity = memberData.weeklyCapacity || 40;
    
    // Get the team allocation percentage (0-100)
    const teamAllocation = memberData.teamAllocation || 100;
    
    // Calculate the duration of the time period in days
    const durationDays = calculateCalendarDuration(startDate, endDate);
    
    // Calculate total capacity for the duration
    const effectiveCapacity = (teamAllocation / 100) * weeklyCapacity;
    
    // Calculate total capacity using the utility function
    const totalCapacity = calculateEffectiveCapacity(
      weeklyCapacity,
      teamAllocation,
      durationDays,
      memberData.daysPerWeek || 5
    );
    
    // Calculate total allocated hours for this time period
    let totalAllocatedHours = 0;
    
    // Sum up all allocations that overlap with this time period
    if (memberData.allocations && Array.isArray(memberData.allocations)) {
      memberData.allocations.forEach(allocation => {
        // Skip allocations that don't overlap
        if (!doTimePeriodsOverlap(
          allocation.startDate || startDate,
          allocation.endDate || endDate,
          startDate,
          endDate
        )) {
          return;
        }
        
        // Add the allocated hours (using totalHours for consistent calculation)
        totalAllocatedHours += allocation.totalHours || 0;
      });
    }
    
    // Subtract the hours to exclude (e.g., current allocation being edited)
    totalAllocatedHours -= excludeHours;
    
    // Calculate available hours
    const availableHours = Math.max(0, totalCapacity - totalAllocatedHours);
    
    // Calculate over-allocation
    const overAllocatedBy = Math.max(0, totalAllocatedHours - totalCapacity);
    
    // Member is available if they have capacity and aren't over-allocated
    const available = availableHours > 0 && overAllocatedBy === 0;
    
    console.log('[AllocationEngine] Member', memberId, 'availability check:', {
      memberId,
      weeklyCapacity,
      teamAllocation,
      effectiveCapacity,
      durationDays,
      totalCapacity,
      excludeHours,
      availableHours,
      overAllocatedBy,
      available
    });
    
    return { available, availableHours, overAllocatedBy };
  }, [memberAllocations]);
  
  return {
    teamMembers,
    memberAllocations,
    checkMemberAvailability,
    refreshAllocations
  };
} 