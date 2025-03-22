import { RFOptionNode, RFOptionNodeData, Neo4jOptionNodeData, RFOptionEdge, Neo4jOptionEdge, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { parseDataFromBackend } from '@/utils/utils';

export function reactFlowToNeo4j(optionNode: RFOptionNode): Neo4jOptionNodeData {
  const data = optionNode.data as RFOptionNodeData; // Cast to ensure type safety
  
  // Check if teamAllocations is already a string to prevent double serialization
  let teamAllocationsValue = undefined;
  if (data.teamAllocations) {
    if (typeof data.teamAllocations === 'string') {
      // If it's already a string, check if it's valid JSON
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(data.teamAllocations);
        // If it parses successfully, use it as is
        teamAllocationsValue = data.teamAllocations;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // If it's not valid JSON, stringify it
        teamAllocationsValue = JSON.stringify(data.teamAllocations);
      }
    } else {
      // If it's an array, stringify it
      teamAllocationsValue = JSON.stringify(data.teamAllocations);
    }
  }

  // Similar checks for other JSON fields
  const teamMembersValue = data.teamMembers ? 
    (typeof data.teamMembers === 'string' ? 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ((() => { try { JSON.parse(data.teamMembers); return data.teamMembers; } catch (_) { return JSON.stringify(data.teamMembers); } })()) : 
      JSON.stringify(data.teamMembers)) : 
    undefined;

  const memberAllocationsValue = data.memberAllocations ? 
    (typeof data.memberAllocations === 'string' ? 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ((() => { try { JSON.parse(data.memberAllocations); return data.memberAllocations; } catch (_) { return JSON.stringify(data.memberAllocations); } })()) : 
      JSON.stringify(data.memberAllocations)) : 
    undefined;
    
  const goalsValue = data.goals ? 
    (typeof data.goals === 'string' ? 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ((() => { try { JSON.parse(data.goals); return data.goals; } catch (_) { return JSON.stringify(data.goals); } })()) : 
      JSON.stringify(data.goals)) : 
    undefined;
    
  const risksValue = data.risks ? 
    (typeof data.risks === 'string' ? 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ((() => { try { JSON.parse(data.risks); return data.risks; } catch (_) { return JSON.stringify(data.risks); } })()) : 
      JSON.stringify(data.risks)) : 
    undefined;
  
  return {
    id: optionNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Option', // Default fallback
    description: data.description,
    title: data.title,
    optionType: data.optionType,
    transactionFeeRate: data.transactionFeeRate,
    monthlyVolume: data.monthlyVolume,
    duration: data.duration,
    teamMembers: teamMembersValue,
    memberAllocations: memberAllocationsValue,
    goals: goalsValue,
    risks: risksValue,
    buildDuration: data.buildDuration,
    timeToClose: data.timeToClose,
    teamAllocations: teamAllocationsValue,
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: optionNode.position.x,
    positionY: optionNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jOptionNodeData): RFOptionNode {
  // Define JSON fields that need special handling
  const jsonFields = ['teamMembers', 'memberAllocations', 'goals', 'risks', 'teamAllocations'];
  
  // Parse all JSON fields
  const parsedData = parseDataFromBackend(neo4jData as unknown as Record<string, unknown>, jsonFields);

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
      teamMembers: parsedData.teamMembers,
      memberAllocations: parsedData.memberAllocations,
      goals: parsedData.goals,
      risks: parsedData.risks,
      buildDuration: neo4jData.buildDuration,
      timeToClose: neo4jData.timeToClose,
      teamAllocations: parsedData.teamAllocations,
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

  // Parse JSON strings back to objects with robust error handling
  let teamMembersData: string[] = [];
  let memberAllocationsData: MemberAllocation[] = [];
  let goalsData: Goal[] = [];
  let risksData: Risk[] = [];
  let teamAllocationsData: TeamAllocation[] = [];

  // Helper function to safely parse JSON with better error reporting
  const safeParseJson = <T>(jsonValue: unknown, defaultValue: T, fieldName: string): T => {
    if (jsonValue === undefined || jsonValue === null) {
      return defaultValue;
    }
    
    // If it's already an array, return it directly
    if (Array.isArray(jsonValue)) {
      console.log(`[transformOptionNode] ${fieldName} is already an array with ${jsonValue.length} elements`);
      return jsonValue as unknown as T;
    }
    
    // If it's not a string, we can't parse it as JSON
    if (typeof jsonValue !== 'string') {
      console.log(`[transformOptionNode] ${fieldName} is not a string (${typeof jsonValue}), returning default`);
      return defaultValue;
    }
    
    // Empty strings should return default
    if (jsonValue.trim() === '') {
      console.log(`[transformOptionNode] ${fieldName} is an empty string, returning default`);
      return defaultValue;
    }
    
    // Ensure it's valid JSON before trying to parse
    if (!jsonValue.trim().startsWith('{') && !jsonValue.trim().startsWith('[')) {
      console.log(`[transformOptionNode] ${fieldName} is not valid JSON format: ${jsonValue.substring(0, 20)}...`);
      return defaultValue;
    }
    
    try {
      return JSON.parse(jsonValue) as T;
    } catch (error) {
      console.error(`[transformOptionNode] Error parsing ${fieldName} JSON:`, error);
      console.log(`[transformOptionNode] ${fieldName} value:`, jsonValue.substring(0, 100));
      return defaultValue;
    }
  };

  // Use the safer parsing function for all fields
  teamMembersData = safeParseJson<string[]>(teamMembers, [], 'teamMembers');
  memberAllocationsData = safeParseJson<MemberAllocation[]>(memberAllocations, [], 'memberAllocations');
  goalsData = safeParseJson<Goal[]>(goals, [], 'goals');
  risksData = safeParseJson<Risk[]>(risks, [], 'risks');
  teamAllocationsData = safeParseJson<TeamAllocation[]>(teamAllocations, [], 'teamAllocations');

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