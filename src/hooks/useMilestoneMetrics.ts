import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useNodeConnections, useReactFlow, Node } from '@xyflow/react';
import { NodeStatus } from '@/hooks/useNodeStatus';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';

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
  const [updateCounter, setUpdateCounter] = useState(0);
  const lastNodesDataRef = useRef('');

  const getConnectedNodes = useCallback(() => {
    return connections
      .map(conn => getNodes().find(n => n.id === conn.source))
      .filter((node): node is Node => node !== undefined)
      .filter((node): node is Node<NodeData> => 
        'data' in node && node.data !== null
      );
  }, [connections, getNodes]);

  useEffect(() => {
    const interval = setInterval(() => {
      const connectedNodes = getConnectedNodes();
      const nodesDataString = JSON.stringify(connectedNodes.map(node => ({
        id: node.id,
        teamAllocations: node.data.teamAllocations,
        costs: node.data.costs,
        monthlyVolume: node.data.monthlyVolume,
        transactionFeeRate: node.data.transactionFeeRate
      })));
      
      if (nodesDataString !== lastNodesDataRef.current) {
        lastNodesDataRef.current = nodesDataString;
        setUpdateCounter(prev => prev + 1);
        console.log('[MilestoneMetrics] Detected changes in connected nodes, updating metrics');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [getConnectedNodes]);

  const metrics = useMemo(() => {
    console.log('[MilestoneMetrics] Recalculating metrics, update counter:', updateCounter);
    const connectedNodes = getConnectedNodes();

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
        if (node.data.costs) {
          let costs = node.data.costs;
          
          if (typeof costs === 'string') {
            try {
              costs = JSON.parse(costs);
              console.log('[MilestoneMetrics] Parsed costs from string:', costs);
            } catch (error) {
              console.error('[MilestoneMetrics] Error parsing costs:', error);
              costs = [];
            }
          }
          
          if (Array.isArray(costs)) {
            costs.forEach(cost => {
              if (!cost.details) return;
              
              let amount = 0;
              
              if (cost.costType === 'fixed' && cost.details.amount) {
                amount = Number(cost.details.amount) || 0;
                
                if (cost.details.frequency === 'annual') {
                  amount = amount / 12;
                }
              }
              
              if (amount > 0) {
                metrics.providerCosts += amount;
                metrics.totalCost += amount;
                
                metrics.providerDetails.push({
                  id: node.id,
                  name: `${nodeTitle} (${cost.name || 'Cost'})`,
                  amount,
                  type: cost.costType
                });
                
                console.log(`[MilestoneMetrics] Added provider cost for ${nodeTitle}:`, {
                  id: node.id,
                  name: `${nodeTitle} (${cost.name || 'Cost'})`,
                  amount,
                  type: cost.costType
                });
              }
            });
          }
        }
      }

      if (node.type === 'option') {
        const monthlyVolume = Number(node.data.monthlyVolume) || 0;
        
        let transactionFeeRate = 0;
        if (node.data.transactionFeeRate) {
          transactionFeeRate = Number(node.data.transactionFeeRate);
        }
        
        const feeRate = transactionFeeRate / 100;
        const monthlyRevenue = monthlyVolume * feeRate;
        
        if (monthlyRevenue > 0) {
          metrics.optionDetails.push({
            id: node.id,
            name: nodeTitle,
            monthlyVolume,
            transactionFeeRate,
            monthlyRevenue
          });
          
          metrics.optionRevenues += monthlyRevenue;
          metrics.monthlyValue += monthlyRevenue;
          
          console.log(`[MilestoneMetrics] Added option revenue for ${nodeTitle}:`, {
            id: node.id,
            name: nodeTitle,
            monthlyVolume,
            transactionFeeRate,
            monthlyRevenue
          });
        }
      }

      if (node.data.teamAllocations) {
        let teamAllocations = node.data.teamAllocations;
        
        if (typeof teamAllocations === 'string') {
          try {
            teamAllocations = JSON.parse(teamAllocations);
            console.log('[MilestoneMetrics] Parsed teamAllocations from string:', teamAllocations);
          } catch (error) {
            console.error('[MilestoneMetrics] Error parsing teamAllocations:', error);
            teamAllocations = [];
          }
        }
        
        if (Array.isArray(teamAllocations)) {
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
          
          teamAllocations.forEach(allocation => {
            if (!Array.isArray(allocation.allocatedMembers)) return;
            
            allocation.allocatedMembers.forEach(member => {
              const memberNode = getNodes().find(n => n.id === member.memberId);
              const memberName = member.name || 
                (memberNode?.data.title ? String(memberNode.data.title) : `Member ${member.memberId.substring(0, 6)}`);
              
              let hourlyRate = Number(memberNode?.data.hourlyRate);
              
              if (!hourlyRate && memberNode?.data.hourlyRate) {
                hourlyRate = Number(memberNode.data.hourlyRate);
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
                memberNodeHourlyRate: memberNode?.data.hourlyRate,
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
          
          if (node.type === 'provider') {
            metrics.providerCosts += featureTotalCost;
            
            metrics.providerDetails.push({
              id: node.id,
              name: `${nodeTitle} (Team)`,
              amount: featureTotalCost,
              type: 'team'
            });
            
            console.log(`[MilestoneMetrics] Added provider team costs for ${nodeTitle}:`, {
              id: node.id,
              name: `${nodeTitle} (Team)`,
              amount: featureTotalCost,
              type: 'team',
              nodeType: node.type
            });
          } else {
            metrics.teamCosts += featureTotalCost;
          }
          metrics.totalCost += featureTotalCost;
        }
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
  }, [getNodes, updateCounter, getConnectedNodes]);

  useEffect(() => {
    const saveMetricsToBackend = async () => {
      try {
        console.log('[useMilestoneMetrics] Saving metrics to backend:', {
          totalCost: metrics.totalCost,
          teamCosts: metrics.teamCosts,
          providerCosts: metrics.providerCosts,
          providerDetails: metrics.providerDetails
        });

        const featureAllocations = metrics.featureAllocations.map(feature => ({
          featureId: feature.featureId,
          name: feature.name,
          totalHours: feature.totalHours,
          totalCost: feature.totalCost
        }));
        
        const optionDetails = metrics.optionDetails.map(option => ({
          optionId: option.id,
          name: option.name,
          monthlyRevenue: option.monthlyRevenue
        }));
        
        const providerDetails = metrics.providerDetails.map(provider => ({
          id: provider.id,
          name: provider.name,
          amount: provider.amount,
          type: provider.type
        }));

        await GraphApiClient.updateNode('milestone' as NodeType, nodeId, {
          totalCost: metrics.totalCost,
          monthlyValue: metrics.monthlyValue,
          teamCosts: metrics.teamCosts,
          providerCosts: metrics.providerCosts,
          featureAllocations: JSON.stringify(featureAllocations),
          optionDetails: JSON.stringify(optionDetails),
          providerDetails: JSON.stringify(providerDetails)
        });
      } catch (error) {
        console.error('[useMilestoneMetrics] Error saving metrics to backend:', error);
      }
    };

    if (connections.length > 0 && 
        (metrics.totalCost > 0 || metrics.providerCosts > 0 || metrics.teamCosts > 0)) {
      const debounceTimeout = setTimeout(() => {
        saveMetricsToBackend();
      }, 2000);
      
      return () => clearTimeout(debounceTimeout);
    }
  }, [nodeId, metrics, connections]);

  return metrics;
} 