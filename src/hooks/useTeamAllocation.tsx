import { useCallback, useEffect, useMemo } from 'react';
import { useNodeConnections, useReactFlow } from '@xyflow/react';

export type MemberAllocation = {
  memberId: string;
  timePercentage: number;
};

export type TeamAllocationData = {
  teamMembers?: string[];
  memberAllocations?: MemberAllocation[];
  duration?: number;
};

// Update the return type to include cost summary component
type CostSummaryProps = {
  costs: {
    dailyCost: number;
    totalCost: number;
    allocations: {
      member: {
        id: string;
        name: string;
        dailyRate?: number;
      };
      allocation: number;
      allocatedDays: number;
      cost: number;
    }[];
  };
  selectedMembers: {
    id: string;
    name: string;
    dailyRate?: number;
  }[];
  duration?: number;
};

export function useTeamAllocation(nodeId: string, data: TeamAllocationData & Record<string, any>) {
  const { updateNodeData, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id: nodeId });

  // Get all team member nodes with proper typing
  const teamMembers = useMemo(() => {
    return getNodes()
      .filter(node => node.type === 'teamMember')
      .map(node => ({
        id: node.id,
        name: node.data.title as string,
        dailyRate: node.data.dailyRate as number | undefined,
      }));
  }, [getNodes]);

  // Get selected team members
  const selectedMembers = useMemo(() => {
    return teamMembers.filter(member => data.teamMembers?.includes(member.id));
  }, [teamMembers, data.teamMembers]);

  // Handle allocation changes
  const handleAllocationChange = useCallback((memberId: string, timePercentage: number) => {
    const currentAllocations = data.memberAllocations || [];
    const newAllocations = currentAllocations.some(a => a.memberId === memberId)
      ? currentAllocations.map(a => 
          a.memberId === memberId 
            ? { ...a, timePercentage } 
            : a
        )
      : [...currentAllocations, { memberId, timePercentage }];

    updateNodeData(nodeId, {
      ...data,
      memberAllocations: newAllocations
    });
  }, [nodeId, data, updateNodeData]);

  // Watch for connection changes
  useEffect(() => {
    const connectedTeamMembers = connections
      .filter(connection => {
        const connectedNode = getNodes().find(node => 
          node.id === connection.source || node.id === connection.target
        );
        const isTeamMember = connectedNode?.type === 'teamMember' && connectedNode.id !== nodeId;
        return isTeamMember;
      })
      .map(connection => 
        connection.source === nodeId ? connection.target : connection.source
      );

    const currentMembers = data.teamMembers || [];
    const newMembers = connectedTeamMembers.filter(
      memberId => !currentMembers.includes(memberId)
    );

    if (newMembers.length > 0) {
      const updatedMembers = [...currentMembers, ...newMembers];
      const currentAllocations = data.memberAllocations || [];
      const newAllocations = newMembers.map(memberId => ({
        memberId,
        timePercentage: 0
      }));

      updateNodeData(nodeId, {
        ...data,
        teamMembers: updatedMembers,
        memberAllocations: [...currentAllocations, ...newAllocations]
      });
    }
  }, [connections, data, nodeId, updateNodeData, getNodes]);

  // Calculate total costs
  const costs = useMemo(() => {
    const dailyCost = selectedMembers.reduce((sum, member) => {
      const allocation = data.memberAllocations?.find(
        a => a.memberId === member.id
      )?.timePercentage || 0;
      return sum + (member.dailyRate || 0) * (allocation / 100);
    }, 0);

    return {
      dailyCost,
      totalCost: dailyCost * (data.duration || 0),
      allocations: selectedMembers.map(member => {
        const allocation = data.memberAllocations?.find(
          a => a.memberId === member.id
        )?.timePercentage || 0;
        const allocatedDays = data.duration 
          ? Math.round((allocation / 100) * data.duration * 10) / 10
          : 0;
        return {
          member,
          allocation,
          allocatedDays,
          cost: (member.dailyRate || 0) * allocatedDays
        };
      })
    };
  }, [selectedMembers, data.memberAllocations, data.duration]);

  // Add cost summary component
  const CostSummary = useCallback(({ costs, selectedMembers, duration }: CostSummaryProps) => {
    if (selectedMembers.length === 0 || !duration) return null;

    return (
      <div className="space-y-4 mt-4 p-3 bg-muted/30 rounded-lg">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Cost Summary</h4>
          
          {/* Resource Breakdown */}
          <div className="space-y-2">
            {selectedMembers.map((member) => {
              const allocation = costs.allocations.find(a => a.member.id === member.id);
              if (!allocation || allocation.allocation === 0) return null;

              return (
                <div key={member.id} className="flex justify-between items-baseline text-sm">
                  <div className="space-x-2">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground">
                      {allocation.allocatedDays} days ({allocation.allocation}%)
                    </span>
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
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t pt-2 mt-4">
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
              <span>Total Duration</span>
              <span className="font-mono">{duration} days</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, []);

  return {
    teamMembers,
    selectedMembers,
    handleAllocationChange,
    costs,
    CostSummary
  };
} 