import { RFMilestoneNode, RFMilestoneNodeData, Neo4jMilestoneNodeData, RFMilestoneEdge, Neo4jMilestoneEdge } from '@/services/graph/milestone/milestone.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function reactFlowToNeo4j(milestoneNode: RFMilestoneNode): Neo4jMilestoneNodeData {
  const data = milestoneNode.data as RFMilestoneNodeData; // Cast to ensure type safety
  
  // Remove any 'milestone-' prefix from the ID if it exists
  // This ensures consistency with meta nodes which don't store the prefix
  const cleanId = milestoneNode.id.startsWith('milestone-') 
    ? milestoneNode.id.substring('milestone-'.length) 
    : milestoneNode.id;
    
  return {
    id: cleanId, // Use clean ID without prefix
    name: data.title || 'Untitled Milestone', // Default fallback
    description: data.description,
    title: data.title,
    status: data.status,
    kpis: data.kpis ? JSON.stringify(data.kpis) : undefined, // Convert KPIs to JSON string for Neo4j
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: milestoneNode.position.x,
    positionY: milestoneNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jMilestoneNodeData): RFMilestoneNode {
  // Parse KPIs from JSON string if available
  const kpis = neo4jData.kpis ? JSON.parse(neo4jData.kpis) : undefined;
  
  return {
    id: neo4jData.id, // Use the ID directly without adding a prefix
    type: 'milestone', // Hardcoded for MilestoneNode
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      status: neo4jData.status,
      kpis,
      name: neo4jData.name,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
    } as RFMilestoneNodeData,
  };
}

export function reactFlowToNeo4jEdge(edge: RFMilestoneEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() as 'DEPENDENCY' | 'RELATED' | string, // Convert to uppercase for Neo4j
    properties: {
      label: edge.data?.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Add other metadata from edge.data as needed
    },
  };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jMilestoneEdge): RFMilestoneEdge {
  console.log('[Transform] Converting Neo4j edge to React Flow edge:', {
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
      // Add other metadata from neo4jEdge.properties as needed
    },
  };
}

export function transformMilestoneNode(node: Neo4jNode): GraphNode<RFMilestoneNodeData> | null {
  if (!node?.properties) return null;

  const type = node.labels[0]?.toLowerCase() as 'milestone';
  if (type !== 'milestone') return null;

  const { positionX, positionY, id, kpis, ...properties } = node.properties;
  
  // Parse KPIs from JSON string if available
  const parsedKpis = kpis ? JSON.parse(kpis as string) : undefined;

  return {
    id: id as string, // Use the ID directly from Neo4j without adding a prefix
    type,
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      title: properties.title as string,
      description: properties.description as string | undefined,
      status: properties.status as string | undefined,
      kpis: parsedKpis,
      name: properties.name as string,
      createdAt: properties.createdAt as string,
      updatedAt: properties.updatedAt as string,
    } as RFMilestoneNodeData,
  };
}

export function transformMilestoneEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jMilestoneEdge = {
    id: relationship.properties.id as string,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: {
      label: relationship.properties.label as string | undefined,
      createdAt: relationship.properties.createdAt as string | undefined,
      updatedAt: relationship.properties.updatedAt as string | undefined,
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