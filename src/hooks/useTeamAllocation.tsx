import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNodeConnections, useReactFlow, Node } from '@xyflow/react';
import { parseTeamAllocations } from '@/lib/utils';

// Core data types
interface TeamNodeData extends Record<string, unknown> {
  title: string;
  roster: Array<RosterMember>;
  season?: {
    startDate: string;
    endDate: string;
    name: string;
  };
}

interface MemberNodeData extends Record<string, unknown> {
  title: string;
  weeklyCapacity: number;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  startDate?: string;
}

interface RosterMember {
  memberId: string;
  allocation: number;  // % of member's time allocated to team
  allocations: Array<WorkAllocation>;
  startDate: string;
}

interface WorkAllocation {
  nodeId: string;
  percentage: number;
  startDate?: string;  // When this allocation begins
  endDate?: string;    // When this allocation ends
  totalHours?: number; // Total hours allocated to this work
}

export interface FeatureNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<TeamAllocation>;
  duration?: number;  // In days
  startDate?: string;
  endDate?: string;
}

interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: Array<MemberAllocation>;
  startDate?: string;
  endDate?: string;
}

interface MemberAllocation {
  memberId: string;
  hours: number;
  hoursPerDay?: number;
  startDate?: string;
  endDate?: string;
  cost?: number;
}

// Return types
interface AvailableMember {
  memberId: string;
  name: string;
  availableHours: number;
  dailyRate: number;
}

interface ConnectedTeam {
  teamId: string;
  title: string;
  availableBandwidth: AvailableMember[];
}

interface CostSummary {
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

// Add these interfaces
interface CostSummaryProps {
  costs: {
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
  };
  duration?: number;
}

// Add the CostSummary component
const CostSummaryComponent = ({ costs, duration }: CostSummaryProps) => {
  return (
    <div className="space-y-4">
      {/* Member Allocations */}
      <div className="space-y-2">
        {costs.allocations.map(allocation => (
          <div key={allocation.member.memberId} className="flex justify-between items-center text-sm">
            <div className="space-y-1">
              <span className="font-medium">{allocation.member.name}</span>
              <div className="text-muted-foreground">
                {allocation.allocatedDays.toFixed(1)} days ({allocation.allocation.toFixed(1)}%)
              </div>
              {allocation.startDate && allocation.endDate && (
                <div className="text-xs text-muted-foreground">
                  {new Date(allocation.startDate).toLocaleDateString()} - {new Date(allocation.endDate).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-muted-foreground">
                ${allocation.cost.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {allocation.hours.toFixed(1)} hours
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium">Total Resource Cost</span>
          <span className="font-mono">
            ${costs.totalCost.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
          <span>Daily Rate</span>
          <span className="font-mono">
            ${costs.dailyCost.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Total Hours</span>
          <span className="font-mono">{costs.totalHours.toFixed(1)} hours</span>
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Working Days</span>
          <span className="font-mono">{costs.totalDays.toFixed(1)} days</span>
        </div>

        {costs.calendarDuration && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Calendar Duration</span>
            <span className="font-mono">{costs.calendarDuration} days</span>
          </div>
        )}

        {duration && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Planned Duration</span>
            <span className="font-mono">{duration} days</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Type guards
function isTeamNode(node: Node | null | undefined): node is Node<TeamNodeData> {
  if (!node || node.type !== 'team' || !node.data) return false;
  const data = node.data as Partial<TeamNodeData>;
  return (
    typeof data.title === 'string' &&
    Array.isArray(data.roster)
  );
}

function isMemberNode(node: Node | null | undefined): node is Node<MemberNodeData> {
  if (!node || node.type !== 'teamMember' || !node.data) return false;
  const data = node.data as Partial<MemberNodeData>;
  return (
    typeof data.title === 'string' &&
    typeof data.weeklyCapacity === 'number'
  );
}

export function useTeamAllocation(nodeId: string, data: FeatureNodeData) {
  // Add a very visible debug log
  console.log('🔍 USE TEAM ALLOCATION HOOK CALLED:', { 
    nodeId, 
    teamAllocations: data.teamAllocations,
    teamAllocationsType: typeof data.teamAllocations,
    isArray: Array.isArray(data.teamAllocations)
  });

  const { updateNodeData, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id: nodeId });

  // Debug connection issues
  console.log('Node Connections:', {
    nodeId,
    connections: connections.map(c => ({
      source: c.source,
      target: c.target,
      sourceNode: getNodes().find(n => n.id === c.source)?.type
    }))
  });

  // Debug team allocations data
  console.log('Team Allocations Data:', {
    nodeId,
    teamAllocations: data.teamAllocations,
    teamAllocationsType: typeof data.teamAllocations,
    isArray: Array.isArray(data.teamAllocations)
  });

  // Track render count to debug refresh issues
  const renderCountRef = useRef(0);
  useEffect(() => {
    renderCountRef.current += 1;
    console.log(`🔄 useTeamAllocation render #${renderCountRef.current} for node ${nodeId}`, {
      teamAllocations: data.teamAllocations,
      teamAllocationsType: typeof data.teamAllocations,
      isArray: Array.isArray(data.teamAllocations),
      hasTeamAllocations: data.teamAllocations && 
        (Array.isArray(data.teamAllocations) ? data.teamAllocations.length > 0 : true)
    });
  });

  // Ensure teamAllocations is always an array
  const teamAllocations = useMemo(() => {
    // If it's already an array, use it directly
    if (Array.isArray(data.teamAllocations)) {
      console.log('✅ useTeamAllocation: teamAllocations is already an array', {
        length: data.teamAllocations.length
      });
      return data.teamAllocations;
    }
    
    // If it's a string, try to parse it
    if (typeof data.teamAllocations === 'string') {
      try {
        const parsed = JSON.parse(data.teamAllocations);
        if (Array.isArray(parsed)) {
          console.log('✅ useTeamAllocation: Successfully parsed teamAllocations string to array', {
            length: parsed.length
          });
          return parsed;
        } else {
          console.warn('⚠️ useTeamAllocation: Parsed teamAllocations is not an array, using empty array');
        }
      } catch (e) {
        console.warn('❌ useTeamAllocation: Failed to parse teamAllocations string, using empty array', e);
      }
    }
    
    // Default to empty array
    console.log('⚠️ useTeamAllocation: Using empty array for teamAllocations');
    return [];
  }, [data.teamAllocations]);

  // Add effect to handle new team connections
  useEffect(() => {
    // Log the connections to help debug
    console.log('🔍 Team connections effect running with connections:', connections.map(c => ({
      source: c.source,
      target: c.target,
      sourceType: getNodes().find(n => n.id === c.source)?.type,
      targetType: getNodes().find(n => n.id === c.target)?.type
    })));
    
    // Get connected team IDs - check both source and target since connections can be in either direction
    const connectedTeamIds = connections
      .map(conn => {
        // Check if the source is a team node
        const sourceNode = getNodes().find(n => n.id === conn.source);
        if (sourceNode?.type === 'team') {
          return sourceNode.id;
        }
        
        // Check if the target is a team node
        const targetNode = getNodes().find(n => n.id === conn.target);
        if (targetNode?.type === 'team') {
          return targetNode.id;
        }
        
        return null;
      })
      .filter((id): id is string => id !== null);
    
    console.log('🔍 Connected team IDs:', connectedTeamIds);

    // Ensure teamAllocations is an array
    let teamAllocationsArray: Array<TeamAllocation> = [];
    
    if (Array.isArray(data.teamAllocations)) {
      teamAllocationsArray = data.teamAllocations;
    } else if (typeof data.teamAllocations === 'string') {
      try {
        teamAllocationsArray = JSON.parse(data.teamAllocations);
        if (!Array.isArray(teamAllocationsArray)) {
          teamAllocationsArray = [];
        }
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
        teamAllocationsArray = [];
      }
    }

    // Initialize allocations for new team connections
    const currentTeams = new Set(teamAllocationsArray.map(a => a.teamId));
    const newTeams = connectedTeamIds.filter(teamId => !currentTeams.has(teamId));

    if (newTeams.length > 0) {
      console.log('🔍 Adding new team allocations for teams:', newTeams);
      updateNodeData(nodeId, {
        ...data,
        teamAllocations: [
          ...teamAllocationsArray,
          ...newTeams.map(teamId => ({
            teamId,
            requestedHours: 0,
            allocatedMembers: []
          }))
        ]
      });
    }
  }, [connections, data, nodeId, updateNodeData, getNodes]);

  // Find connected teams
  const connectedTeams = useMemo(() => {
    // Get all team nodes connected to this node - check both source and target
    const teamNodes = connections
      .map(conn => {
        // Check if the source is a team node
        const sourceNode = getNodes().find(n => n.id === conn.source);
        if (sourceNode?.type === 'team') {
          return sourceNode;
        }
        
        // Check if the target is a team node
        const targetNode = getNodes().find(n => n.id === conn.target);
        if (targetNode?.type === 'team') {
          return targetNode;
        }
        
        return null;
      })
      .filter((node): node is Node<TeamNodeData> => node !== null && node.type === 'team')
      .map(teamNode => {
        if (!isTeamNode(teamNode)) return null;
        
        // Get all team members connected to this team
        const availableBandwidth = teamNode.data.roster
          .map(member => {
            const memberNode = getNodes().find(n => n.id === member.memberId);
            if (!isMemberNode(memberNode)) return null;
            
            // Calculate available hours based on allocation
            const weeklyHours = memberNode.data.hoursPerDay * memberNode.data.daysPerWeek;
            const allocatedHours = (member.allocation / 100) * weeklyHours;
            
            return {
              memberId: member.memberId,
              name: memberNode.data.title,
              availableHours: allocatedHours,
              dailyRate: memberNode.data.dailyRate || 0,
            };
          })
          .filter((member): member is AvailableMember => member !== null);
        
        return {
          teamId: teamNode.id,
          title: teamNode.data.title,
          availableBandwidth,
        };
      })
      .filter((team): team is ConnectedTeam => team !== null);
    
    return teamNodes;
  }, [connections, getNodes]);

  const requestTeamAllocation = useCallback((
    teamId: string, 
    requestedHours: number,
    memberIds: string[],
    startDate?: string,
    endDate?: string
  ) => {
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!isTeamNode(teamNode)) return;

    // Use feature dates or calculate reasonable defaults
    const featureStartDate = startDate || data.startDate || new Date().toISOString().split('T')[0];
    const featureDuration = data.duration || 10; // Default to 10 days if not specified
    
    // Calculate end date if not provided
    let featureEndDate = endDate || data.endDate;
    if (!featureEndDate) {
      const start = new Date(featureStartDate);
      // Add duration in business days (approximation)
      const end = new Date(start);
      end.setDate(start.getDate() + Math.ceil(featureDuration * 1.4)); // Add buffer for weekends
      featureEndDate = end.toISOString().split('T')[0];
    }

    // Calculate working days between start and end dates for later use
    const startDateObj = new Date(featureStartDate);
    const endDateObj = new Date(featureEndDate);
    const daysDiff = Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Update team node allocations
    const updatedRoster = teamNode.data.roster.map(member => {
      if (!memberIds.includes(member.memberId)) return member;

      const memberNode = getNodes().find(n => n.id === member.memberId);
      if (!isMemberNode(memberNode)) return member;

      // Find existing allocation for this work node
      const existingAllocationIndex = member.allocations.findIndex(a => a.nodeId === nodeId);
      
      // Calculate hours per day for this member
      const memberHoursPerDay = memberNode.data.hoursPerDay ?? 8;
      const daysPerWeek = memberNode.data.daysPerWeek ?? 5;
      const weeklyHours = memberHoursPerDay * daysPerWeek;
      
      // Calculate working days for this member based on their schedule
      const workingDays = Math.round(daysDiff * (daysPerWeek / 7)); // Adjust for working days
      
      // Calculate hours per member and percentage of capacity
      const hoursPerMember = requestedHours / memberIds.length;
      const memberDailyHours = hoursPerMember / workingDays;
      const dailyPercentage = (memberDailyHours / memberHoursPerDay) * 100;
      const weeklyPercentage = (hoursPerMember / weeklyHours) * 100;
      const newPercentage = Math.min(100, dailyPercentage);

      let updatedAllocations;
      if (existingAllocationIndex >= 0) {
        // Update existing allocation
        updatedAllocations = [...member.allocations];
        updatedAllocations[existingAllocationIndex] = {
          nodeId,
          percentage: newPercentage,
          startDate: featureStartDate,
          endDate: featureEndDate,
          totalHours: hoursPerMember
        };
      } else {
        // Add new allocation
        updatedAllocations = [
          ...member.allocations,
          {
            nodeId,
            percentage: newPercentage,
            startDate: featureStartDate,
            endDate: featureEndDate,
            totalHours: hoursPerMember
          }
        ];
      }

      // Calculate total utilization from all work nodes
      const totalUtilization = updatedAllocations.reduce((sum, allocation) => 
        sum + allocation.percentage, 0);

      return {
        ...member,
        allocation: Math.min(100, totalUtilization), // Update member's team allocation
        allocations: updatedAllocations
      };
    });

    updateNodeData(teamId, {
      ...teamNode.data,
      roster: updatedRoster
    });

    // Update feature/option node allocations
    // Use the utility function to ensure teamAllocations is an array
    const teamAllocationsArray = parseTeamAllocations(data.teamAllocations);

    // Find existing team allocation if any
    const existingTeamAllocation = teamAllocationsArray.find(a => a.teamId === teamId);
    
    // Create member allocations with cost calculations for the new members
    const newMemberAllocations = memberIds.map(memberId => {
      const memberNode = getNodes().find(n => n.id === memberId);
      if (!isMemberNode(memberNode)) {
        return {
          memberId,
          hours: requestedHours / memberIds.length
        };
      }
      
      const hoursPerMember = requestedHours / memberIds.length;
      const dailyRate = memberNode.data.dailyRate || 350; // Default rate if not specified
      const memberHoursPerDay = memberNode.data.hoursPerDay || 8;
      const daysPerWeek = memberNode.data.daysPerWeek ?? 5;
      const memberWorkingDays = Math.round(daysDiff * (daysPerWeek / 7));
      const daysEquivalent = hoursPerMember / memberHoursPerDay;
      const cost = daysEquivalent * dailyRate;
      
      return {
        memberId,
        hours: hoursPerMember,
        hoursPerDay: hoursPerMember / memberWorkingDays,
        startDate: featureStartDate,
        endDate: featureEndDate,
        cost
      };
    });

    // Merge existing and new member allocations
    let mergedMemberAllocations: MemberAllocation[] = [];
    
    if (existingTeamAllocation) {
      // Keep existing allocations for members not in the new memberIds list
      const existingAllocations = existingTeamAllocation.allocatedMembers.filter(
        (member: MemberAllocation) => !memberIds.includes(member.memberId)
      );
      
      // Combine with new allocations
      mergedMemberAllocations = [...existingAllocations, ...newMemberAllocations];
    } else {
      mergedMemberAllocations = newMemberAllocations;
    }

    // Calculate total requested hours based on all member allocations
    const totalRequestedHours = mergedMemberAllocations.reduce(
      (sum: number, member: MemberAllocation) => sum + member.hours, 
      0
    );

    const updatedTeamAllocations = [
      ...teamAllocationsArray.filter(a => a.teamId !== teamId),
      {
        teamId,
        requestedHours: totalRequestedHours,
        allocatedMembers: mergedMemberAllocations,
        startDate: featureStartDate,
        endDate: featureEndDate
      }
    ];

    // Update the feature/option/provider node with allocation data
    updateNodeData(nodeId, {
      ...data,
      teamAllocations: updatedTeamAllocations,
      startDate: featureStartDate,
      endDate: featureEndDate
    });
  }, [nodeId, data, getNodes, updateNodeData]);

  // Add this function after requestTeamAllocation
  const removeMemberAllocation = useCallback((
    teamId: string,
    memberId: string
  ) => {
    // Get the team node
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!isTeamNode(teamNode)) return;

    // Get the member node
    const memberNode = getNodes().find(n => n.id === memberId);
    if (!isMemberNode(memberNode)) return;

    // Update the team roster to remove this allocation
    const updatedRoster = teamNode.data.roster.map(member => {
      if (member.memberId !== memberId) return member;

      // Remove the allocation for this node
      const updatedAllocations = member.allocations.filter(a => a.nodeId !== nodeId);
      
      // Recalculate total utilization
      const totalUtilization = updatedAllocations.reduce((sum, allocation) => 
        sum + allocation.percentage, 0);

      return {
        ...member,
        allocation: Math.min(100, totalUtilization),
        allocations: updatedAllocations
      };
    });

    // Update the team node
    updateNodeData(teamId, {
      ...teamNode.data,
      roster: updatedRoster
    });

    // Update the feature node
    // Use the utility function to ensure teamAllocations is an array
    const teamAllocationsArray = parseTeamAllocations(data.teamAllocations);

    // Find the team allocation
    const teamAllocation = teamAllocationsArray.find(a => a.teamId === teamId);
    if (!teamAllocation) return;

    // Remove the member from the allocation
    const updatedMembers = teamAllocation.allocatedMembers.filter((m: MemberAllocation) => m.memberId !== memberId);
    
    // Calculate new total requested hours
    const totalRequestedHours = updatedMembers.reduce((sum: number, m: MemberAllocation) => sum + m.hours, 0);

    // Update the team allocations
    const updatedTeamAllocations = teamAllocationsArray.map(a => {
      if (a.teamId !== teamId) return a;
      
      return {
        ...a,
        requestedHours: totalRequestedHours,
        allocatedMembers: updatedMembers
      };
    });

    // Update the feature node
    updateNodeData(nodeId, {
      ...data,
      teamAllocations: updatedTeamAllocations
    });
  }, [nodeId, data, getNodes, updateNodeData]);

  // Add this function after removeMemberAllocation
  const updateMemberAllocation = useCallback((
    teamId: string,
    memberId: string,
    hours: number,
    startDate?: string,
    endDate?: string
  ) => {
    // Get the team node
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!isTeamNode(teamNode)) return;

    // Get the member node
    const memberNode = getNodes().find(n => n.id === memberId);
    if (!isMemberNode(memberNode)) return;

    // Use feature dates or calculate reasonable defaults
    const featureStartDate = startDate || data.startDate || new Date().toISOString().split('T')[0];
    const featureDuration = data.duration || 10; // Default to 10 days if not specified
    
    // Calculate end date if not provided
    let featureEndDate = endDate || data.endDate;
    if (!featureEndDate) {
      const start = new Date(featureStartDate);
      // Add duration in business days (approximation)
      const end = new Date(start);
      end.setDate(start.getDate() + Math.ceil(featureDuration * 1.4)); // Add buffer for weekends
      featureEndDate = end.toISOString().split('T')[0];
    }

    // Calculate working days between start and end dates for later use
    const startDateObj = new Date(featureStartDate);
    const endDateObj = new Date(featureEndDate);
    const daysDiff = Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Update the team roster for this member
    const updatedRoster = teamNode.data.roster.map(member => {
      if (member.memberId !== memberId) return member;

      // Calculate hours per day for this member
      const memberHoursPerDay = memberNode.data.hoursPerDay ?? 8;
      const daysPerWeek = memberNode.data.daysPerWeek ?? 5;
      const weeklyHours = memberHoursPerDay * daysPerWeek;
      
      // Calculate working days for this member based on their schedule
      const workingDays = Math.round(daysDiff * (daysPerWeek / 7)); // Adjust for working days
      
      // Calculate percentage of capacity
      const memberDailyHours = hours / workingDays;
      const dailyPercentage = (memberDailyHours / memberHoursPerDay) * 100;
      const newPercentage = Math.min(100, dailyPercentage);

      // Find existing allocation for this node
      const existingAllocationIndex = member.allocations.findIndex(a => a.nodeId === nodeId);
      
      let updatedAllocations;
      if (existingAllocationIndex >= 0) {
        // Update existing allocation
        updatedAllocations = [...member.allocations];
        updatedAllocations[existingAllocationIndex] = {
          nodeId,
          percentage: newPercentage,
          startDate: featureStartDate,
          endDate: featureEndDate,
          totalHours: hours
        };
      } else {
        // Add new allocation
        updatedAllocations = [
          ...member.allocations,
          {
            nodeId,
            percentage: newPercentage,
            startDate: featureStartDate,
            endDate: featureEndDate,
            totalHours: hours
          }
        ];
      }

      // Calculate total utilization from all work nodes
      const totalUtilization = updatedAllocations.reduce((sum, allocation) => 
        sum + allocation.percentage, 0);

      return {
        ...member,
        allocation: Math.min(100, totalUtilization),
        allocations: updatedAllocations
      };
    });

    // Update the team node
    updateNodeData(teamId, {
      ...teamNode.data,
      roster: updatedRoster
    });

    // Update the feature node
    // Use the utility function to ensure teamAllocations is an array
    const teamAllocationsArray = parseTeamAllocations(data.teamAllocations);

    // Find the team allocation
    const teamAllocationIndex = teamAllocationsArray.findIndex(a => a.teamId === teamId);
    
    if (teamAllocationIndex >= 0) {
      // Create updated member allocation
      const dailyRate = memberNode.data.dailyRate || 350;
      const memberHoursPerDay = memberNode.data.hoursPerDay || 8;
      const daysEquivalent = hours / memberHoursPerDay;
      const cost = daysEquivalent * dailyRate;
      
      const updatedMemberAllocation = {
        memberId,
        hours,
        hoursPerDay: hours / Math.round(daysDiff * ((memberNode.data.daysPerWeek ?? 5) / 7)),
        startDate: featureStartDate,
        endDate: featureEndDate,
        cost
      };

      // Update or add the member allocation
      const existingTeamAllocation = teamAllocationsArray[teamAllocationIndex];
      const memberIndex = existingTeamAllocation.allocatedMembers.findIndex((m: MemberAllocation) => m.memberId === memberId);
      
      let updatedMembers;
      if (memberIndex >= 0) {
        // Update existing member
        updatedMembers = [...existingTeamAllocation.allocatedMembers];
        updatedMembers[memberIndex] = updatedMemberAllocation;
      } else {
        // Add new member
        updatedMembers = [...existingTeamAllocation.allocatedMembers, updatedMemberAllocation];
      }
      
      // Calculate new total requested hours
      const totalRequestedHours = updatedMembers.reduce((sum: number, m: MemberAllocation) => sum + m.hours, 0);
      
      // Update the team allocations
      const updatedTeamAllocations = [...teamAllocationsArray];
      updatedTeamAllocations[teamAllocationIndex] = {
        ...existingTeamAllocation,
        requestedHours: totalRequestedHours,
        allocatedMembers: updatedMembers
      };
      
      // Update the feature node
      updateNodeData(nodeId, {
        ...data,
        teamAllocations: updatedTeamAllocations
      });
    } else {
      // Create new team allocation with this member
      const dailyRate = memberNode.data.dailyRate || 350;
      const memberHoursPerDay = memberNode.data.hoursPerDay || 8;
      const daysEquivalent = hours / memberHoursPerDay;
      const cost = daysEquivalent * dailyRate;
      
      const newTeamAllocation = {
        teamId,
        requestedHours: hours,
        allocatedMembers: [{
          memberId,
          hours,
          hoursPerDay: hours / Math.round(daysDiff * ((memberNode.data.daysPerWeek ?? 5) / 7)),
          startDate: featureStartDate,
          endDate: featureEndDate,
          cost
        }],
        startDate: featureStartDate,
        endDate: featureEndDate
      };
      
      // Update the feature node
      updateNodeData(nodeId, {
        ...data,
        teamAllocations: [...teamAllocationsArray, newTeamAllocation]
      });
    }
  }, [nodeId, data, getNodes, updateNodeData]);

  // Calculate costs based on team allocations
  const costs = useMemo(() => {
    // Start with empty cost summary
    const costSummary: CostSummary = {
      dailyCost: 0,
      totalCost: 0,
      totalHours: 0,
      totalDays: 0,
      allocations: [],
    };
    
    // If no team allocations, return empty cost summary
    if (!teamAllocations || teamAllocations.length === 0) {
      return costSummary;
    }
    
    // Calculate costs for each team allocation
    teamAllocations.forEach(allocation => {
      // Find the team in connected teams
      const team = connectedTeams.find(t => t.teamId === allocation.teamId);
      if (!team) return;
      
      // Calculate costs for each allocated member
      allocation.allocatedMembers.forEach((member: MemberAllocation) => {
        // Find the member in the team's available bandwidth
        const teamMember = team.availableBandwidth.find(m => m.memberId === member.memberId);
        if (!teamMember) return;
        
        // Calculate allocated days and cost
        const hoursPerDay = member.hoursPerDay || 8; // Default to 8 hours per day
        const allocatedDays = member.hours / hoursPerDay;
        const cost = allocatedDays * teamMember.dailyRate;
        
        // Add to cost summary
        costSummary.allocations.push({
          member: {
            memberId: member.memberId,
            name: teamMember.name,
            dailyRate: teamMember.dailyRate,
          },
          allocation: (member.hours / teamMember.availableHours) * 100,
          allocatedDays,
          hours: member.hours,
          hoursPerDay,
          startDate: member.startDate,
          endDate: member.endDate,
          cost,
        });
        
        // Update totals
        costSummary.totalCost += cost;
        costSummary.totalHours += member.hours;
        costSummary.totalDays += allocatedDays;
      });
    });
    
    // Calculate daily cost
    costSummary.dailyCost = costSummary.totalDays > 0 ? costSummary.totalCost / costSummary.totalDays : 0;
    
    // Calculate calendar duration if we have start and end dates
    const allDates = costSummary.allocations
      .filter(a => a.startDate && a.endDate)
      .map(a => ({
        start: new Date(a.startDate!),
        end: new Date(a.endDate!),
      }));
    
    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates.map(d => d.start.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.end.getTime())));
      const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      costSummary.calendarDuration = diffDays;
    }
    
    return costSummary;
  }, [teamAllocations, connectedTeams]);

  return {
    connectedTeams,
    requestTeamAllocation,
    removeMemberAllocation,
    updateMemberAllocation,
    costs,
    CostSummary: CostSummaryComponent
  };
} 