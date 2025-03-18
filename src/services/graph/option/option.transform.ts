import { RFOptionNode, RFOptionNodeData, Neo4jOptionNodeData, RFOptionEdge, Neo4jOptionEdge, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

/**
 * Helper function to safely parse JSON strings
 * @param jsonString The string to parse as JSON
 * @param defaultValue The default value to return if parsing fails
 * @returns The parsed JSON object or the default value
 */
function safeJsonParse<T>(jsonString: string | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  
  // Check if the string is a valid JSON before attempting to parse
  if (typeof jsonString !== 'string' || !jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
    return defaultValue;
  }
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.warn('Failed to parse JSON string:', e);
    return defaultValue;
  }
}

export function reactFlowToNeo4j(optionNode: RFOptionNode): Neo4jOptionNodeData {
  const data = optionNode.data as RFOptionNodeData; // Cast to ensure type safety
  
  // Helper function to safely handle JSON serialization
  const safeJsonStringify = (value: unknown): string | undefined => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(value);
        // If it parses successfully, use it as is
        return value;
      } catch {
        // If it's not valid JSON, stringify it
        return JSON.stringify(value);
      }
    } else {
      // If it's an object/array, stringify it
      return JSON.stringify(value);
    }
  };
  
  return {
    id: optionNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Option', // Default fallback
    description: data.description,
    title: data.title,
    optionType: data.optionType,
    transactionFeeRate: data.transactionFeeRate,
    monthlyVolume: data.monthlyVolume,
    duration: data.duration,
    teamMembers: safeJsonStringify(data.teamMembers),
    memberAllocations: safeJsonStringify(data.memberAllocations),
    goals: safeJsonStringify(data.goals),
    risks: safeJsonStringify(data.risks),
    buildDuration: data.buildDuration,
    timeToClose: data.timeToClose,
    teamAllocations: safeJsonStringify(data.teamAllocations),
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: optionNode.position.x,
    positionY: optionNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jOptionNodeData): RFOptionNode {
  // Parse JSON strings back to objects using the safe parser
  const teamMembers = safeJsonParse<string[]>(neo4jData.teamMembers, []);
  const memberAllocations = safeJsonParse<MemberAllocation[]>(neo4jData.memberAllocations, []);
  const goals = safeJsonParse<Goal[]>(neo4jData.goals, []);
  const risks = safeJsonParse<Risk[]>(neo4jData.risks, []);
  const teamAllocations = safeJsonParse<TeamAllocation[]>(neo4jData.teamAllocations, []);

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

  // Parse JSON strings back to objects using the safe parser
  const teamMembersData = safeJsonParse<string[]>(teamMembers as string, []);
  const memberAllocationsData = safeJsonParse<MemberAllocation[]>(memberAllocations as string, []);
  const goalsData = safeJsonParse<Goal[]>(goals as string, []);
  const risksData = safeJsonParse<Risk[]>(risks as string, []);
  const teamAllocationsData = safeJsonParse<TeamAllocation[]>(teamAllocations as string, []);

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