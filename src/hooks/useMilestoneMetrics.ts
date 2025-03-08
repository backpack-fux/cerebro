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
  teamCosts: number;
  providerCosts: number;
  optionRevenues: number;
  memberAllocations: Array<{
    memberId: string;
    name: string;
    hours: number;
    hourlyRate: number;
    cost: number;
  }>;
  featureAllocations: Array<{
    featureId: string;
    name: string;
    members: Array<{
      memberId: string;
      name: string;
      hours: number;
      cost: number;
    }>;
    totalHours: number;
    totalCost: number;
  }>;
  providerDetails: Array<{
    id: string;
    name: string;
    amount: number;
    type: string;
  }>;
  optionDetails: Array<{
    id: string;
    name: string;
    monthlyVolume: number;
    transactionFeeRate: number;
    monthlyRevenue: number;
  }>;
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
  title?: string;
  costs?: ProviderCost[];
  monthlyVolume?: number;
  transactionFeeRate?: number;
  teamAllocations?: Array<{
    teamId: string;
    allocatedMembers: Array<{
      memberId: string;
      name?: string;
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

    const metrics: MilestoneMetrics = {
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
      isComplete: false,
      teamCosts: 0,
      providerCosts: 0,
      optionRevenues: 0,
      memberAllocations: [],
      featureAllocations: [],
      providerDetails: [],
      optionDetails: []
    };

    const memberAllocationsMap = new Map<string, {
      memberId: string;
      name: string;
      hours: number;
      hourlyRate: number;
      cost: number;
    }>();

    const featureAllocationsMap = new Map<string, {
      featureId: string;
      name: string;
      members: Map<string, {
        memberId: string;
        name: string;
        hours: number;
        cost: number;
      }>;
      totalHours: number;
      totalCost: number;
    }>();

    connectedNodes.forEach(node => {
      const status = (node.data.status || 'planning') as NodeStatus;
      metrics.statusCounts[status] = (metrics.statusCounts[status] || 0) + 1;
      metrics.nodeCount++;
      if (status === 'completed') metrics.completedCount++;

      const nodeTitle = String(node.data.title || node.id);

      if (node.type === 'provider') {
        let costs = [];
        
        if (Array.isArray(node.data.costs)) {
          costs = node.data.costs;
        } else if (typeof node.data.costs === 'string') {
          try {
            const parsed = JSON.parse(node.data.costs);
            if (Array.isArray(parsed)) {
              costs = parsed;
            }
          } catch (e) {
            console.warn('Failed to parse costs string:', e);
          }
        }
        
        if (costs.length > 0) {
          const providerCosts = costs.reduce((sum, cost) => {
            if (!cost.details) return sum;
            
            let costAmount = 0;
            
            switch (cost.details.type) {
              case 'fixed':
                costAmount = (Number(cost.details.amount) || 0) * 
                  (cost.details.frequency === 'annual' ? 1/12 : 1);
                break;
              case 'unit':
                costAmount = (Number(cost.details.minimumMonthly) || 0);
                break;
              case 'revenue':
                costAmount = (Number(cost.details.minimumMonthly) || 0);
                break;
              default:
                costAmount = 0;
            }
            
            if (costAmount > 0) {
              metrics.providerDetails.push({
                id: cost.id,
                name: cost.name || 'Unnamed Cost',
                amount: costAmount,
                type: cost.details.type
              });
            }
            
            return sum + costAmount;
          }, 0);
          
          metrics.providerCosts += providerCosts;
          metrics.totalCost += providerCosts;
        }
      }

      if (node.type === 'option') {
        const monthlyVolume = Number(node.data.monthlyVolume) || 0;
        const feeRate = (Number(node.data.transactionFeeRate) || 0) / 100;
        const monthlyRevenue = monthlyVolume * feeRate;
        
        if (monthlyRevenue > 0) {
          metrics.optionDetails.push({
            id: node.id,
            name: nodeTitle,
            monthlyVolume,
            transactionFeeRate: Number(node.data.transactionFeeRate) || 0,
            monthlyRevenue
          });
        }
        
        metrics.optionRevenues += monthlyRevenue;
        metrics.monthlyValue += monthlyRevenue;
      }

      if (node.data.teamAllocations && Array.isArray(node.data.teamAllocations)) {
        let featureTotalHours = 0;
        let featureTotalCost = 0;
        
        let featureAllocation = featureAllocationsMap.get(node.id);
        if (!featureAllocation) {
          featureAllocation = {
            featureId: node.id,
            name: nodeTitle,
            members: new Map(),
            totalHours: 0,
            totalCost: 0
          };
          featureAllocationsMap.set(node.id, featureAllocation);
        }
        
        node.data.teamAllocations.forEach(allocation => {
          if (!Array.isArray(allocation.allocatedMembers)) return;
          
          allocation.allocatedMembers.forEach(member => {
            const memberNode = getNodes().find(n => n.id === member.memberId);
            const memberName = member.name || 
              (memberNode?.data.title ? String(memberNode.data.title) : `Member ${member.memberId.substring(0, 6)}`);
            
            let hourlyRate = Number(memberNode?.data.hourlyRate);
            
            if (!hourlyRate && memberNode?.data.dailyRate) {
              hourlyRate = Number(memberNode.data.dailyRate);
            }
            
            if (!hourlyRate) {
              hourlyRate = 350;
            }
            
            const memberHours = Number(member.hours) || 0;
            const memberCost = memberHours * hourlyRate;
            
            console.log(`[MilestoneMetrics] Member ${memberName} cost calculation:`, {
              hours: memberHours,
              hourlyRate,
              cost: memberCost,
              dailyRate: memberNode?.data.dailyRate,
              nodeType: node.type
            });
            
            let featureMember = featureAllocation.members.get(member.memberId);
            if (featureMember) {
              featureMember.hours += memberHours;
              featureMember.cost += memberCost;
            } else {
              featureMember = {
                memberId: member.memberId,
                name: memberName,
                hours: memberHours,
                cost: memberCost
              };
              featureAllocation.members.set(member.memberId, featureMember);
            }
            
            featureTotalHours += memberHours;
            featureTotalCost += memberCost;
            
            if (memberAllocationsMap.has(member.memberId)) {
              const existing = memberAllocationsMap.get(member.memberId)!;
              memberAllocationsMap.set(member.memberId, {
                ...existing,
                hours: existing.hours + memberHours,
                cost: existing.cost + memberCost
              });
            } else {
              memberAllocationsMap.set(member.memberId, {
                memberId: member.memberId,
                name: memberName,
                hours: memberHours,
                hourlyRate,
                cost: memberCost
              });
            }
          });
        });
        
        featureAllocation.totalHours += featureTotalHours;
        featureAllocation.totalCost += featureTotalCost;
        
        metrics.teamCosts += featureTotalCost;
        metrics.totalCost += featureTotalCost;
      }
    });

    metrics.memberAllocations = Array.from(memberAllocationsMap.values())
      .sort((a, b) => b.cost - a.cost);

    metrics.featureAllocations = Array.from(featureAllocationsMap.values())
      .map(feature => ({
        ...feature,
        members: Array.from(feature.members.values())
          .sort((a, b) => b.hours - a.hours)
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    metrics.providerDetails.sort((a, b) => b.amount - a.amount);

    metrics.optionDetails.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

    metrics.isComplete = metrics.nodeCount > 0 && metrics.completedCount === metrics.nodeCount;

    console.log('[MilestoneMetrics] Final metrics:', {
      totalCost: metrics.totalCost,
      teamCosts: metrics.teamCosts,
      providerCosts: metrics.providerCosts,
      featureAllocations: metrics.featureAllocations.map(f => ({
        name: f.name,
        totalCost: f.totalCost,
        members: Array.from(f.members.values()).map(m => ({
          name: m.name,
          hours: m.hours,
          cost: m.cost
        }))
      }))
    });

    return metrics;
  }, [connections, getNodes]);
} 