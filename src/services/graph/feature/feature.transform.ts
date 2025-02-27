import { RFFeatureNode, RFFeatureNodeData, Neo4jFeatureNodeData, RFFeatureEdge, Neo4jFeatureEdge, MemberAllocation, TeamAllocation } from '@/services/graph/feature/feature.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function reactFlowToNeo4j(featureNode: RFFeatureNode): Neo4jFeatureNodeData {
  const data = featureNode.data as RFFeatureNodeData; // Cast to ensure type safety
  return {
    id: featureNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Feature', // Default fallback
    description: data.description,
    title: data.title,
    buildType: data.buildType,
    cost: data.cost,
    duration: data.duration,
    timeUnit: data.timeUnit,
    teamMembers: data.teamMembers ? JSON.stringify(data.teamMembers) : undefined,
    memberAllocations: data.memberAllocations ? JSON.stringify(data.memberAllocations) : undefined,
    teamAllocations: data.teamAllocations ? JSON.stringify(data.teamAllocations) : undefined,
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: featureNode.position.x,
    positionY: featureNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jFeatureNodeData): RFFeatureNode {
  // Parse JSON strings back to objects
  let teamMembers: string[] = [];
  let memberAllocations: MemberAllocation[] = [];
  let teamAllocations: TeamAllocation[] = [];

  // Safely parse teamMembers
  if (neo4jData.teamMembers) {
    try {
      if (typeof neo4jData.teamMembers === 'string') {
        teamMembers = JSON.parse(neo4jData.teamMembers);
      } else if (Array.isArray(neo4jData.teamMembers)) {
        teamMembers = neo4jData.teamMembers;
      }
    } catch (error) {
      console.error('Error parsing teamMembers JSON:', error);
      teamMembers = [];
    }
  }

  // Safely parse memberAllocations
  if (neo4jData.memberAllocations) {
    try {
      if (typeof neo4jData.memberAllocations === 'string') {
        memberAllocations = JSON.parse(neo4jData.memberAllocations);
      } else if (Array.isArray(neo4jData.memberAllocations)) {
        memberAllocations = neo4jData.memberAllocations;
      }
    } catch (error) {
      console.error('Error parsing memberAllocations JSON:', error);
      memberAllocations = [];
    }
  }

  // Safely parse teamAllocations
  if (neo4jData.teamAllocations) {
    try {
      if (typeof neo4jData.teamAllocations === 'string') {
        teamAllocations = JSON.parse(neo4jData.teamAllocations);
      } else if (Array.isArray(neo4jData.teamAllocations)) {
        teamAllocations = neo4jData.teamAllocations;
      }
    } catch (error) {
      console.error('Error parsing teamAllocations JSON:', error);
      teamAllocations = [];
    }
  }

  return {
    id: neo4jData.id,
    type: 'feature', // Hardcoded for FeatureNode
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      name: neo4jData.name,
      buildType: neo4jData.buildType as 'internal' | 'external' | undefined,
      cost: neo4jData.cost,
      duration: neo4jData.duration,
      timeUnit: neo4jData.timeUnit as 'days' | 'weeks' | undefined,
      teamMembers: teamMembers,
      memberAllocations: memberAllocations,
      teamAllocations: teamAllocations,
      status: neo4jData.status,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
    } as RFFeatureNodeData,
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