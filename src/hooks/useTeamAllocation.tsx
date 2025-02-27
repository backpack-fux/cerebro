import { useCallback, useEffect, useMemo } from 'react';
import { useNodeConnections, useReactFlow, Node } from '@xyflow/react';

// Core data types
interface TeamNodeData extends Record<string, unknown> {
  title: string;
  roster: Array<RosterMember>;
}

interface MemberNodeData extends Record<string, unknown> {
  title: string;
  weeklyCapacity: number;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
}

interface RosterMember {
  memberId: string;
  allocation: number;  // % of member's time allocated to team
  allocations: Array<WorkAllocation>;
}

interface WorkAllocation {
  nodeId: string;
  percentage: number;
}

export interface FeatureNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<TeamAllocation>;
  duration?: number;
}

interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: Array<{
    memberId: string;
    hours: number;
  }>;
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
  allocations: Array<{
    member: {
      memberId: string;
      name: string;
      dailyRate: number;
    };
    allocation: number;
    allocatedDays: number;
    cost: number;
  }>;
}

// Add these interfaces
interface CostSummaryProps {
  costs: CostSummary;
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
                {allocation.allocatedDays} days ({allocation.allocation.toFixed(1)}%)
              </div>
            </div>
            {allocation.cost > 0 && (
              <span className="font-mono text-muted-foreground">
                ${allocation.cost.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            )}
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

        {duration && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Total Duration</span>
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

  // Add effect to handle new team connections
  useEffect(() => {
    const connectedTeamIds = connections
      .map(conn => {
        const node = getNodes().find(n => n.id === conn.source);
        return isTeamNode(node) ? node.id : null;
      })
      .filter((id): id is string => id !== null);

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

  const connectedTeams = useMemo(() => {
    return connections
      .filter(conn => {
        const sourceNode = getNodes().find(n => n.id === conn.source);
        return sourceNode?.type === 'team';
      })
      .map(conn => {
        const teamNode = getNodes().find(n => n.id === conn.source);
        if (!isTeamNode(teamNode)) return null;

        const availableBandwidth = teamNode.data.roster
          .map(member => {
            const memberNode = getNodes().find(n => n.id === member.memberId);
            if (!isMemberNode(memberNode)) return null;

            const weeklyCapacity = memberNode.data.weeklyCapacity;
            const teamAllocation = member.allocation;
            const totalTeamHours = (weeklyCapacity * teamAllocation) / 100;

            return {
              memberId: member.memberId,
              name: memberNode.data.title,
              availableHours: totalTeamHours,
              dailyRate: memberNode.data.dailyRate ?? 350
            };
          })
          .filter((bandwidth): bandwidth is AvailableMember => bandwidth !== null);

        return {
          teamId: teamNode.id,
          title: teamNode.data.title,
          availableBandwidth
        };
      })
      .filter((team): team is ConnectedTeam => team !== null);
  }, [connections, getNodes, nodeId]);

  const requestTeamAllocation = useCallback((
    teamId: string, 
    requestedHours: number,
    memberIds: string[]
  ) => {
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!isTeamNode(teamNode)) return;

    // Update team node allocations
    const updatedRoster = teamNode.data.roster.map(member => {
      if (!memberIds.includes(member.memberId)) return member;

      const memberNode = getNodes().find(n => n.id === member.memberId);
      if (!isMemberNode(memberNode)) return member;

      // Find existing allocation for this work node
      const existingAllocationIndex = member.allocations.findIndex(a => a.nodeId === nodeId);
      
      // Calculate hours per day for this member
      const hoursPerDay = memberNode.data.hoursPerDay ?? 12;
      const daysPerWeek = memberNode.data.daysPerWeek ?? 6;
      const weeklyHours = hoursPerDay * daysPerWeek;
      
      // Calculate percentage of weekly capacity
      const weeklyPercentage = (requestedHours / weeklyHours) * 100;
      const newPercentage = Math.min(100, weeklyPercentage);

      let updatedAllocations;
      if (existingAllocationIndex >= 0) {
        // Update existing allocation
        updatedAllocations = [...member.allocations];
        updatedAllocations[existingAllocationIndex] = {
          nodeId,
          percentage: newPercentage
        };
      } else {
        // Add new allocation
        updatedAllocations = [
          ...member.allocations,
          {
            nodeId,
            percentage: newPercentage
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

    const updatedTeamAllocations = [
      ...teamAllocationsArray.filter(a => a.teamId !== teamId),
      {
        teamId,
        requestedHours,
        allocatedMembers: memberIds.map(id => ({
          memberId: id,
          hours: requestedHours / memberIds.length
        }))
      }
    ];

    updateNodeData(nodeId, {
      ...data,
      teamAllocations: updatedTeamAllocations
    });
  }, [nodeId, data, getNodes, updateNodeData]);

  // Calculate costs based on team allocations
  const costs = useMemo(() => {
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
    
    const allocations = teamAllocationsArray.flatMap(teamAllocation => {
      // Ensure teamAllocation is a valid object
      if (!teamAllocation || typeof teamAllocation !== 'object') {
        return [];
      }
      
      // Ensure allocatedMembers is an array
      const allocatedMembers = Array.isArray(teamAllocation.allocatedMembers) 
        ? teamAllocation.allocatedMembers 
        : [];
      
      return allocatedMembers.map(member => {
        // Ensure member is a valid object
        if (!member || typeof member !== 'object') {
          return null;
        }
        
        const team = connectedTeams.find(t => t.teamId === teamAllocation.teamId);
        const bandwidthMember = team?.availableBandwidth.find(bw => bw.memberId === member.memberId);
        
        if (!bandwidthMember) return null;

        const allocatedDays = member.hours / 8;
        const dailyRate = bandwidthMember.dailyRate;
        const cost = dailyRate * allocatedDays;

        return {
          member: {
            memberId: member.memberId,
            name: bandwidthMember.name,
            dailyRate
          },
          allocation: (member.hours / (data.duration || 1) / 8) * 100,
          allocatedDays,
          cost
        };
      })
    }).filter((allocation): allocation is NonNullable<typeof allocation> => allocation !== null);

    return {
      dailyCost: allocations?.reduce((sum, a) => sum + a.member.dailyRate * (a.allocation / 100), 0) || 0,
      totalCost: allocations?.reduce((sum, a) => sum + a.cost, 0) || 0,
      allocations: allocations || []
    };
  }, [data.teamAllocations, data.duration, connectedTeams]);

  return {
    connectedTeams,
    requestTeamAllocation,
    costs,
    CostSummary: CostSummaryComponent  // Return the component
  };
} 