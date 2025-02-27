import { RFOptionNode, RFOptionNodeData, Neo4jOptionNodeData, RFOptionEdge, Neo4jOptionEdge, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function reactFlowToNeo4j(optionNode: RFOptionNode): Neo4jOptionNodeData {
  const data = optionNode.data as RFOptionNodeData; // Cast to ensure type safety
  return {
    id: optionNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Option', // Default fallback
    description: data.description,
    title: data.title,
    optionType: data.optionType,
    transactionFeeRate: data.transactionFeeRate,
    monthlyVolume: data.monthlyVolume,
    duration: data.duration,
    teamMembers: data.teamMembers ? JSON.stringify(data.teamMembers) : undefined,
    memberAllocations: data.memberAllocations ? JSON.stringify(data.memberAllocations) : undefined,
    goals: data.goals ? JSON.stringify(data.goals) : undefined,
    risks: data.risks ? JSON.stringify(data.risks) : undefined,
    buildDuration: data.buildDuration,
    timeToClose: data.timeToClose,
    teamAllocations: data.teamAllocations ? JSON.stringify(data.teamAllocations) : undefined,
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: optionNode.position.x,
    positionY: optionNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jOptionNodeData): RFOptionNode {
  // Parse JSON strings back to objects
  let teamMembers: string[] = [];
  let memberAllocations: MemberAllocation[] = [];
  let goals: Goal[] = [];
  let risks: Risk[] = [];
  let teamAllocations: TeamAllocation[] = [];

  try {
    if (neo4jData.teamMembers) {
      try {
        const parsedTeamMembers = JSON.parse(neo4jData.teamMembers);
        teamMembers = Array.isArray(parsedTeamMembers) ? parsedTeamMembers : [];
      } catch (e) {
        console.warn('Failed to parse teamMembers string:', e);
      }
    }
    if (neo4jData.memberAllocations) {
      try {
        const parsedMemberAllocations = JSON.parse(neo4jData.memberAllocations);
        memberAllocations = Array.isArray(parsedMemberAllocations) ? parsedMemberAllocations : [];
      } catch (e) {
        console.warn('Failed to parse memberAllocations string:', e);
      }
    }
    if (neo4jData.goals) {
      try {
        const parsedGoals = JSON.parse(neo4jData.goals);
        goals = Array.isArray(parsedGoals) ? parsedGoals : [];
      } catch (e) {
        console.warn('Failed to parse goals string:', e);
      }
    }
    if (neo4jData.risks) {
      try {
        const parsedRisks = JSON.parse(neo4jData.risks);
        risks = Array.isArray(parsedRisks) ? parsedRisks : [];
      } catch (e) {
        console.warn('Failed to parse risks string:', e);
      }
    }
    if (neo4jData.teamAllocations) {
      try {
        const parsedTeamAllocations = JSON.parse(neo4jData.teamAllocations);
        teamAllocations = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
      }
    }
  } catch (error) {
    console.error('Error in neo4jToReactFlow:', error);
  }

  return {
    id: neo4jData.id,
    type: 'option', // Hardcoded for OptionNode
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      name: neo4jData.name,
      optionType: neo4jData.optionType as 'customer' | 'contract' | 'partner' | undefined,
      transactionFeeRate: neo4jData.transactionFeeRate,
      monthlyVolume: neo4jData.monthlyVolume,
      duration: neo4jData.duration,
      teamMembers: teamMembers,
      memberAllocations: memberAllocations,
      goals: goals,
      risks: risks,
      buildDuration: neo4jData.buildDuration,
      timeToClose: neo4jData.timeToClose,
      teamAllocations: teamAllocations,
      status: neo4jData.status,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
    } as RFOptionNodeData,
  };
}

export function reactFlowToNeo4jEdge(edge: RFOptionEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() as 'OPTION_TEAM' | 'OPTION_MEMBER' | 'OPTION_DEPENDENCY' | string, // Convert to uppercase for Neo4j
    properties: {
      label: edge.data?.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allocation: edge.data?.allocation, // Include allocation if available
      // Add other metadata from edge.data as needed
    },
  };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jOptionEdge): RFOptionEdge {
  console.log('[Transform] Converting Neo4j option edge to React Flow edge:', {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  });
  
  return {
    id: neo4jEdge.id,
    source: neo4jEdge.from,
    target: neo4jEdge.to,
    type: 'default', // Use default edge type for ReactFlow
    data: {
      label: neo4jEdge.properties?.label,
      edgeType: neo4jEdge.type.toLowerCase(), // Store the original edge type in data
      allocation: neo4jEdge.properties?.allocation, // Include allocation if available
    },
  };
}

export function transformOptionNode(node: Neo4jNode): GraphNode<RFOptionNodeData> | null {
  if (!node?.properties) return null;

  // Check if this is an option node by looking at labels
  const type = node.labels.find(label => 
    label.toLowerCase() === 'option' || 
    label.toLowerCase() === 'option_node'
  )?.toLowerCase();
  
  if (!type) return null;

  const { 
    positionX, 
    positionY, 
    id, 
    teamMembers, 
    memberAllocations, 
    goals,
    risks,
    teamAllocations, 
    ...properties 
  } = node.properties;

  // Parse JSON strings back to objects
  let teamMembersData: string[] = [];
  let memberAllocationsData: MemberAllocation[] = [];
  let goalsData: Goal[] = [];
  let risksData: Risk[] = [];
  let teamAllocationsData: TeamAllocation[] = [];

  try {
    if (teamMembers) {
      try {
        const parsedTeamMembers = JSON.parse(teamMembers as string);
        teamMembersData = Array.isArray(parsedTeamMembers) ? parsedTeamMembers : [];
      } catch (e) {
        console.warn('Failed to parse teamMembers string:', e);
      }
    }
    if (memberAllocations) {
      try {
        const parsedMemberAllocations = JSON.parse(memberAllocations as string);
        memberAllocationsData = Array.isArray(parsedMemberAllocations) ? parsedMemberAllocations : [];
      } catch (e) {
        console.warn('Failed to parse memberAllocations string:', e);
      }
    }
    if (goals) {
      try {
        const parsedGoals = JSON.parse(goals as string);
        goalsData = Array.isArray(parsedGoals) ? parsedGoals : [];
      } catch (e) {
        console.warn('Failed to parse goals string:', e);
      }
    }
    if (risks) {
      try {
        const parsedRisks = JSON.parse(risks as string);
        risksData = Array.isArray(parsedRisks) ? parsedRisks : [];
      } catch (e) {
        console.warn('Failed to parse risks string:', e);
      }
    }
    if (teamAllocations) {
      try {
        const parsedTeamAllocations = JSON.parse(teamAllocations as string);
        teamAllocationsData = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
      }
    }
  } catch (error) {
    console.error('Error in transformOptionNode:', error);
  }

  return {
    id: id as string,
    type: 'option', // Normalize to 'option' for frontend
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      title: properties.title as string,
      description: properties.description as string | undefined,
      name: properties.name as string,
      optionType: properties.optionType as 'customer' | 'contract' | 'partner' | undefined,
      transactionFeeRate: properties.transactionFeeRate as number | undefined,
      monthlyVolume: properties.monthlyVolume as number | undefined,
      duration: properties.duration as number | undefined,
      teamMembers: teamMembersData,
      memberAllocations: memberAllocationsData,
      goals: goalsData,
      risks: risksData,
      buildDuration: properties.buildDuration as number | undefined,
      timeToClose: properties.timeToClose as number | undefined,
      teamAllocations: teamAllocationsData,
      status: properties.status as string | undefined,
      createdAt: properties.createdAt as string,
      updatedAt: properties.updatedAt as string,
    } as RFOptionNodeData,
  };
}

export function transformOptionEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jOptionEdge = {
    id: relationship.properties.id as string,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: {
      label: relationship.properties.label as string | undefined,
      createdAt: relationship.properties.createdAt as string | undefined,
      updatedAt: relationship.properties.updatedAt as string | undefined,
      allocation: relationship.properties.allocation as number | undefined,
    },
  };

  // Convert to GraphEdge
  return {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  };
} 