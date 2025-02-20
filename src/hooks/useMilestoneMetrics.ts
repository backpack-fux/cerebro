import { useMemo } from 'react';
import { useNodeConnections, useReactFlow, Node } from '@xyflow/react';
import { NodeStatus } from '@/hooks/useNodeStatus';

interface MilestoneMetrics {
  totalCost: number;
  monthlyValue: number;
  nodeCount: number;
  completedCount: number;
  statusCounts: Record<NodeStatus, number>;
  isComplete: boolean;
}

interface ProviderCost {
  id: string;
  name: string;
  costType: 'fixed' | 'unit' | 'revenue' | 'tiered';
  details: {
    type: string;
    amount?: number;
    frequency?: 'monthly' | 'annual';
    unitPrice?: number;
    percentage?: number;
    minimumMonthly?: number;
  };
}

interface NodeData extends Record<string, unknown> {
  status?: string;
  costs?: ProviderCost[];
  monthlyVolume?: number;
  transactionFeeRate?: number;
  teamAllocations?: Array<{
    teamId: string;
    allocatedMembers: Array<{
      memberId: string;
      hours: number;
    }>;
  }>;
}

export function useMilestoneMetrics(nodeId: string) {
  const { getNodes } = useReactFlow();
  const connections = useNodeConnections({ id: nodeId });

  return useMemo(() => {
    const connectedNodes = connections
      .map(conn => getNodes().find(n => n.id === conn.source))
      .filter((node): node is Node => node !== undefined)
      .filter((node): node is Node<NodeData> => 
        'data' in node && node.data !== null
      );

    return connectedNodes.reduce<MilestoneMetrics>((metrics, node) => {
      // Track node status
      const status = (node.data.status || 'planning') as NodeStatus;
      metrics.statusCounts[status] = (metrics.statusCounts[status] || 0) + 1;
      metrics.nodeCount++;
      if (status === 'completed') metrics.completedCount++;

      // Calculate costs and value
      if (node.type === 'provider' && Array.isArray(node.data.costs)) {
        // Handle provider costs
        const providerCosts = node.data.costs.reduce((sum, cost) => {
          if (!cost.details) return sum;
          
          switch (cost.details.type) {
            case 'fixed':
              return sum + (Number(cost.details.amount) || 0) * 
                (cost.details.frequency === 'annual' ? 1/12 : 1);
            case 'unit':
              return sum + (Number(cost.details.minimumMonthly) || 0);
            case 'revenue':
              return sum + (Number(cost.details.minimumMonthly) || 0);
            default:
              return sum;
          }
        }, 0);
        metrics.totalCost += providerCosts;
      }

      if (node.type === 'option') {
        // Add option value
        const monthlyVolume = Number(node.data.monthlyVolume) || 0;
        const feeRate = (Number(node.data.transactionFeeRate) || 0) / 100;
        metrics.monthlyValue += monthlyVolume * feeRate;
      }

      // Add team allocation costs
      if (node.data.teamAllocations && Array.isArray(node.data.teamAllocations)) {
        const teamCosts = node.data.teamAllocations.reduce((sum, allocation) => {
          if (!Array.isArray(allocation.allocatedMembers)) return sum;
          
          return sum + allocation.allocatedMembers.reduce((memberSum, member) => {
            const memberNode = getNodes().find(n => n.id === member.memberId);
            const dailyRate = Number(memberNode?.data.dailyRate) || 350;
            return memberSum + ((Number(member.hours) / 8) * dailyRate);
          }, 0);
        }, 0);
        metrics.totalCost += teamCosts;
      }

      return metrics;
    }, {
      totalCost: 0,
      monthlyValue: 0,
      nodeCount: 0,
      completedCount: 0,
      statusCounts: {
        planning: 0,
        in_progress: 0,
        completed: 0,
        active: 0
      },
      isComplete: false
    });
  }, [connections, getNodes]);
} 