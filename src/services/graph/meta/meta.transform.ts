import { RFMetaNode, RFMetaNodeData, Neo4jMetaNodeData, RFMetaEdge, Neo4jMetaEdge } from '@/services/graph/meta/meta.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function reactFlowToNeo4j(metaNode: RFMetaNode): Neo4jMetaNodeData {
  const data = metaNode.data as RFMetaNodeData; // Cast to ensure type safety
  return {
    id: metaNode.id, // Use React Flow's string ID
    name: data.name || 'Untitled', // Default fallback
    description: data.description,
    title: data.title,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: metaNode.position.x,
    positionY: metaNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jMetaNodeData): RFMetaNode {
    return {
      id: neo4jData.id,
      type: 'meta', // Hardcoded for MetaNode, adjust for dynamic node types if needed
      position: { x: neo4jData.positionX, y: neo4jData.positionY },
      data: {
        title: neo4jData.title,
        description: neo4jData.description,
        name: neo4jData.name,
        createdAt: neo4jData.createdAt,
        updatedAt: neo4jData.updatedAt,
      } as RFMetaNodeData,
    };
}

export function reactFlowToNeo4jEdge(edge: RFMetaEdge): GraphEdge {
    return {
      id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
      from: edge.source,
      to: edge.target,
      type: edge.type?.toUpperCase() as 'KNOWLEDGE_BASE' | 'ROADMAP' | string, // Convert to uppercase for Neo4j
      properties: {
        label: edge.data?.label,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Add other metadata from edge.data as needed
      },
    };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jMetaEdge): RFMetaEdge {
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

export function transformMetaNode(node: Neo4jNode): GraphNode<RFMetaNodeData> | null {
    if (!node?.properties) return null;
  
    const type = node.labels[0]?.toLowerCase() as 'meta';
    if (type !== 'meta') return null;
  
    const { positionX, positionY, id, ...properties } = node.properties;
  
    return {
      id: id as string,
      type,
      position: {
        x: typeof positionX === 'number' ? positionX : 0,
        y: typeof positionY === 'number' ? positionY : 0,
      },
      data: {
        title: properties.title as string,
        description: properties.description as string | undefined,
        name: properties.name as string,
        createdAt: properties.createdAt as string,
        updatedAt: properties.updatedAt as string,
      } as RFMetaNodeData,
    };
}

export function transformMetaEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jMetaEdge = {
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

  // Convert to GraphEdge instead of RFMetaEdge
  return {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  };
}