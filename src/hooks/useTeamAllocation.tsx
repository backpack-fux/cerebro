import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNodeConnections, useReactFlow, Node } from '@xyflow/react';

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
  teamAllocations?: Array<TeamAllocation> | string;
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
  name?: string;
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
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
}

interface ConnectedTeam {
  teamId: string;
  name: string;
  requestedHours: number;
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

interface CostSummaryProps {
  costs: CostSummary;
  duration?: number;
}

// Cost Summary Component
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

/**
 * Parse JSON data if it's a string, or return the original value if it's already parsed
 * @param value The value to parse
 * @param defaultValue Default value to return if parsing fails
 */
function parseJsonIfString<T>(value: unknown, defaultValue: T): T {
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

/**
 * Hook for managing team allocations for feature nodes
 */
export function useTeamAllocation(nodeId: string, data: FeatureNodeData) {
  const { updateNodeData, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id: nodeId });

  // Refs for caching team allocations
  const previousTeamAllocationsStringifiedRef = useRef<string>('');
  const previousTeamAllocationsResultRef = useRef<TeamAllocation[]>([]);
  
  // Refs for caching connected teams
  const prevConnectionsStringRef = useRef<string>('');
  const prevConnectedTeamsResultRef = useRef<ConnectedTeam[]>([]);
  
  // Ref to track if we're in the middle of an update to prevent cascading updates
  const isUpdatingRef = useRef(false);
  
  // Ref to track the last processed connections to prevent redundant updates
  const lastProcessedConnectionsRef = useRef<string>('');
  
  // Refs for caching cost calculations
  const prevCostCacheKeyRef = useRef('');
  const prevCostResultRef = useRef<CostSummary>({
    dailyCost: 0,
    totalCost: 0,
    totalHours: 0,
    totalDays: 0,
    allocations: [],
  });

  // Ref to track node IDs that have already been confirmed to not exist
  const nonExistentNodeIdsRef = useRef<Set<string>>(new Set());

  // Parse team allocations from the node data
  const processedTeamAllocations = useMemo(() => {
    return parseJsonIfString<TeamAllocation[]>(data.teamAllocations, []);
  }, [data.teamAllocations]);

  // Update the getNodes function to filter out known non-existent nodes
  const getNodesWithFilter = useCallback(() => {
    const allNodes = getNodes();
    return allNodes.filter(node => !nonExistentNodeIdsRef.current.has(node.id));
  }, [getNodes]);

  // Effect to handle blocking specific node requests that repeatedly fail
  useEffect(() => {
    // Look for any non-existent node IDs from connection data and add to our blocklist
    const potentialNodeIds = connections.map(c => [c.source, c.target]).flat();
    
    // We have seen from logs that this specific node is causing 404 errors
    const knownBadNodeId = '95c72037-da89-4bfe-af8f-ea847cbdbe87';
    if (potentialNodeIds.includes(knownBadNodeId) && !nonExistentNodeIdsRef.current.has(knownBadNodeId)) {
      nonExistentNodeIdsRef.current.add(knownBadNodeId);
    }
  }, [connections]);

  // Get connected teams
  const connectedTeams = useMemo(() => {
    // Use the cached result if connections haven't changed
    const connectionsString = JSON.stringify(connections);
    if (connectionsString === prevConnectionsStringRef.current) {
      return prevConnectedTeamsResultRef.current;
    }
    
    // Update the cache
    prevConnectionsStringRef.current = connectionsString;
    
    // Get all nodes
    const nodes = getNodes();
    
    // Filter for team nodes that are connected to this feature
    const teamNodes = connections
      .filter(c => {
        const sourceNode = nodes.find(n => n.id === c.source);
        return sourceNode && sourceNode.type === 'team';
      })
      .map(c => {
        const teamNode = nodes.find(n => n.id === c.source);
        if (!teamNode) return null;
        
        // Find the team allocation for this team
        const teamAllocation = processedTeamAllocations.find(a => a.teamId === teamNode.id);
        
        // Process the team's roster if available
        let availableBandwidth: AvailableMember[] = [];
        
        // Check if the team node has a roster
        if (teamNode.data.roster) {
          try {
            // Parse the roster if it's a string
            const roster = parseJsonIfString<RosterMember[]>(teamNode.data.roster, []);
            
            // Map the roster to available members
            availableBandwidth = roster.map((member: any) => {
              // Find the actual team member node to get the correct name and capacity
              const memberNode = nodes.find(n => n.id === member.memberId);
              const memberName = memberNode?.data?.title || member.name || member.memberId.split('-')[0];
              
              // Get the actual capacity values from the team member node
              const hoursPerDay = Number(memberNode?.data?.hoursPerDay) || 8;
              const daysPerWeek = Number(memberNode?.data?.daysPerWeek) || 5;
              const weeklyCapacity = Number(memberNode?.data?.weeklyCapacity) || (hoursPerDay * daysPerWeek);
              
              // Calculate available hours based on allocation percentage and weekly capacity
              const allocatedPercentage = Number(member.allocation) || 0;
              const availablePercentage = 100 - allocatedPercentage;
              const availableHours = (availablePercentage / 100) * weeklyCapacity;
              
              // Get the daily rate from the team member node or use a default
              const dailyRate = Number(memberNode?.data?.dailyRate) || 350;
              
              return {
                memberId: member.memberId,
                name: memberName,
                availableHours,
                dailyRate,
                hoursPerDay,
                daysPerWeek,
                weeklyCapacity
              };
            });
          } catch (e) {
            // Error handled silently, returns empty array
          }
        }
        
        return {
          teamId: teamNode.id,
          name: String(teamNode.data.title || teamNode.data.name || 'Unnamed Team'),
          requestedHours: teamAllocation?.requestedHours || 0,
          availableBandwidth
        } as ConnectedTeam;
      })
      .filter(Boolean) as ConnectedTeam[];
    
    // Cache the result
    prevConnectedTeamsResultRef.current = teamNodes;
    
    return teamNodes;
  }, [connections, getNodes, processedTeamAllocations]);
  
  // Request team allocation
  const requestTeamAllocation = useCallback((
    teamId: string, 
    requestedHours: number, 
    memberData: string[] | Array<{ memberId: string; name?: string; hours?: number }> = []
  ) => {
    if (!teamId) {
      return;
    }
    
    // Get the current team allocations
    const currentAllocations = processedTeamAllocations;
    
    // Find the existing allocation for this team
    const existingAllocationIndex = currentAllocations.findIndex(a => a.teamId === teamId);
    
    // Create a new allocations array
    const newAllocations = [...currentAllocations];
    
    // Get the team node to access its roster
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!teamNode) {
      return;
    }
    
    // Get the team's roster
    const roster = parseJsonIfString<RosterMember[]>(teamNode.data.roster, []);
    
    // Process member data
    let allocatedMembers: Array<{ memberId: string; name?: string; hours: number }> = [];
    
    // If we're updating specific members, preserve existing allocations for other members
    if (existingAllocationIndex >= 0) {
      // Start with existing allocated members
      allocatedMembers = [...currentAllocations[existingAllocationIndex].allocatedMembers];
      
      // Process the new member data
      if (Array.isArray(memberData)) {
        memberData.forEach(member => {
          if (typeof member === 'string') {
            // Find the member in the roster
            const rosterMember = roster.find(r => r.memberId === member);
            if (!rosterMember) return;
            
            // Calculate hours based on allocation percentage
            const memberAllocation = rosterMember.allocation || 0;
            const hours = (memberAllocation / 100) * requestedHours;
            
            // Find if this member is already in allocatedMembers
            const existingMemberIndex = allocatedMembers.findIndex(m => m.memberId === member);
            if (existingMemberIndex >= 0) {
              // Update existing member
              allocatedMembers[existingMemberIndex].hours = hours;
            } else {
              // Add new member
              allocatedMembers.push({
                memberId: member,
                hours
              });
            }
          } else {
            // Member is an object with memberId, name, and hours
            const { memberId, name, hours = 0 } = member;
            
            // Find if this member is already in allocatedMembers
            const existingMemberIndex = allocatedMembers.findIndex(m => m.memberId === memberId);
            if (existingMemberIndex >= 0) {
              // Update existing member
              allocatedMembers[existingMemberIndex] = {
                ...allocatedMembers[existingMemberIndex],
                name: name || allocatedMembers[existingMemberIndex].name,
                hours: hours
              };
            } else {
              // Add new member
              allocatedMembers.push({
                memberId,
                name,
                hours
              });
            }
          }
        });
      }
    } else {
      // No existing allocation, create new allocated members
      if (Array.isArray(memberData)) {
        memberData.forEach(member => {
          if (typeof member === 'string') {
            // Find the member in the roster
            const rosterMember = roster.find(r => r.memberId === member);
            if (!rosterMember) return;
            
            // Calculate hours based on allocation percentage
            const memberAllocation = rosterMember.allocation || 0;
            const hours = (memberAllocation / 100) * requestedHours;
            
            allocatedMembers.push({
              memberId: member,
              hours
            });
          } else {
            // Member is an object with memberId, name, and hours
            const { memberId, name, hours = 0 } = member;
            allocatedMembers.push({
              memberId,
              name,
              hours
            });
          }
        });
      }
    }
    
    // Calculate total requested hours from allocated members
    const totalRequestedHours = allocatedMembers.reduce((sum, member) => sum + member.hours, 0);
    
    // Create or update the team allocation
    if (existingAllocationIndex >= 0) {
      // Update existing allocation
      newAllocations[existingAllocationIndex] = {
        ...newAllocations[existingAllocationIndex],
        requestedHours: totalRequestedHours,
        allocatedMembers
      };
    } else {
      // Create new allocation
      newAllocations.push({
        teamId,
        requestedHours: totalRequestedHours,
        allocatedMembers
      });
    }
    
    // Update the node data
    updateNodeData(nodeId, {
      ...data,
      teamAllocations: newAllocations
    });
    
    // Return the updated allocations
    return newAllocations;
  }, [data, getNodes, nodeId, updateNodeData, processedTeamAllocations]);

  // Remove member allocation
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
    const teamAllocationsArray = processedTeamAllocations;

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
  }, [nodeId, data, getNodes, updateNodeData, processedTeamAllocations]);

  // Update member allocation
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
    const teamAllocationsArray = processedTeamAllocations;

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
        name: memberNode.data.title,
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
          name: memberNode.data.title,
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
  }, [nodeId, data, getNodes, updateNodeData, processedTeamAllocations]);

  // Calculate costs based on team allocations
  const costs = useMemo(() => {
    // Add caching to prevent unnecessary recalculations
    const teamAllocationsString = JSON.stringify(processedTeamAllocations);
    const connectedTeamsString = JSON.stringify(connectedTeams.map(t => t.teamId));
    const cacheKey = `${teamAllocationsString}-${connectedTeamsString}`;
    
    // Return cached result if inputs haven't changed
    if (cacheKey === prevCostCacheKeyRef.current) {
      return prevCostResultRef.current;
    }
    
    // Start with empty cost summary
    const costSummary: CostSummary = {
      dailyCost: 0,
      totalCost: 0,
      totalHours: 0,
      totalDays: 0,
      allocations: [],
    };
    
    // If no team allocations, return empty cost summary
    if (!processedTeamAllocations || processedTeamAllocations.length === 0) {
      prevCostCacheKeyRef.current = cacheKey;
      prevCostResultRef.current = costSummary;
      return costSummary;
    }
    
    // Calculate costs for each team allocation
    processedTeamAllocations.forEach(allocation => {
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
    
    // Update cache
    prevCostCacheKeyRef.current = cacheKey;
    prevCostResultRef.current = costSummary;
    
    return costSummary;
  }, [processedTeamAllocations, connectedTeams]);

  return {
    connectedTeams,
    teamAllocations: processedTeamAllocations,
    requestTeamAllocation,
    removeMemberAllocation,
    updateMemberAllocation,
    costs,
    CostSummary: CostSummaryComponent
  };
} 