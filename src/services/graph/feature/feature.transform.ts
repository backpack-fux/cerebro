import { RFFeatureNode, RFFeatureNodeData, Neo4jFeatureNodeData, RFFeatureEdge, Neo4jFeatureEdge, MemberAllocation, TeamAllocation } from '@/services/graph/feature/feature.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { parseDataFromBackend } from '@/utils/utils';

export function reactFlowToNeo4j(featureNode: RFFeatureNode): Neo4jFeatureNodeData {
  const data = featureNode.data as RFFeatureNodeData; // Cast to ensure type safety

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
      } catch (e) {
        // If it's not valid JSON, stringify it
        teamAllocationsValue = JSON.stringify(data.teamAllocations);
      }
    } else {
      // If it's an array, stringify it
      teamAllocationsValue = JSON.stringify(data.teamAllocations);
    }
  }

  // Similar checks for teamMembers and memberAllocations
  let teamMembersValue = data.teamMembers ? 
    (typeof data.teamMembers === 'string' ? 
      ((() => { try { JSON.parse(data.teamMembers); return data.teamMembers; } catch (e) { return JSON.stringify(data.teamMembers); } })()) : 
      JSON.stringify(data.teamMembers)) : 
    undefined;

  let memberAllocationsValue = data.memberAllocations ? 
    (typeof data.memberAllocations === 'string' ? 
      ((() => { try { JSON.parse(data.memberAllocations); return data.memberAllocations; } catch (e) { return JSON.stringify(data.memberAllocations); } })()) : 
      JSON.stringify(data.memberAllocations)) : 
    undefined;

  return {
    id: featureNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Feature', // Default fallback
    description: data.description,
    title: data.title,
    buildType: data.buildType,
    cost: data.cost,
    duration: data.duration,
    timeUnit: data.timeUnit,
    teamMembers: teamMembersValue,
    memberAllocations: memberAllocationsValue,
    teamAllocations: teamAllocationsValue,
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: featureNode.position.x,
    positionY: featureNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jFeatureNodeData): RFFeatureNode {
  // Define JSON fields that need special handling
  const jsonFields = ['teamMembers', 'memberAllocations', 'teamAllocations', 'availableBandwidth'];
  
  // Parse all JSON fields
  const parsedData = parseDataFromBackend(neo4jData, jsonFields);
  
  return {
    id: neo4jData.id,
    type: 'feature',
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      buildType: neo4jData.buildType,
      cost: neo4jData.cost,
      duration: neo4jData.duration,
      timeUnit: neo4jData.timeUnit,
      status: neo4jData.status,
      teamMembers: parsedData.teamMembers,
      memberAllocations: parsedData.memberAllocations,
      teamAllocations: parsedData.teamAllocations,
      availableBandwidth: parsedData.availableBandwidth,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt
    } as RFFeatureNodeData
  };
}

export function reactFlowToNeo4jEdge(edge: RFFeatureEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() as 'FEATURE_TEAM' | 'FEATURE_MEMBER' | 'FEATURE_DEPENDENCY' | string, // Convert to uppercase for Neo4j
    properties: {
      label: edge.data?.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allocation: edge.data?.allocation, // Include allocation if available
      // Add other metadata from edge.data as needed
    },
  };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jFeatureEdge): RFFeatureEdge {
  console.log('[Transform] Converting Neo4j feature edge to React Flow edge:', {
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

export function transformFeatureNode(node: Neo4jNode): GraphNode<RFFeatureNodeData> | null {
  if (!node?.properties) return null;

  // Check if this is a feature node by looking at labels
  const type = node.labels.find(label => 
    label.toLowerCase() === 'feature' || 
    label.toLowerCase() === 'feature_node'
  )?.toLowerCase();
  
  if (!type) return null;

  const { 
    positionX, 
    positionY, 
    id, 
    teamMembers, 
    memberAllocations, 
    teamAllocations, 
    ...properties 
  } = node.properties;

  // Parse JSON strings back to objects
  let teamMembersData: string[] = [];
  let memberAllocationsData: MemberAllocation[] = [];
  let teamAllocationsData: TeamAllocation[] = [];

  try {
    if (teamMembers) {
      teamMembersData = JSON.parse(teamMembers as string) as string[];
    }
    if (memberAllocations) {
      memberAllocationsData = JSON.parse(memberAllocations as string) as MemberAllocation[];
    }
    if (teamAllocations) {
      teamAllocationsData = JSON.parse(teamAllocations as string) as TeamAllocation[];
    }
  } catch (error) {
    console.error('Error parsing JSON data from Neo4j:', error);
  }

  return {
    id: id as string,
    type: 'feature', // Normalize to 'feature' for frontend
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      title: properties.title as string,
      description: properties.description as string | undefined,
      name: properties.name as string,
      buildType: properties.buildType as 'internal' | 'external' | undefined,
      cost: properties.cost as number | undefined,
      duration: properties.duration as number | undefined,
      timeUnit: properties.timeUnit as 'days' | 'weeks' | undefined,
      teamMembers: teamMembersData,
      memberAllocations: memberAllocationsData,
      teamAllocations: teamAllocationsData,
      status: properties.status as string | undefined,
      createdAt: properties.createdAt as string,
      updatedAt: properties.updatedAt as string,
    } as RFFeatureNodeData,
  };
}

export function transformFeatureEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jFeatureEdge = {
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