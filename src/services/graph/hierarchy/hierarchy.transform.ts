/**
 * Hierarchy Transform Functions
 * 
 * This file contains functions to transform hierarchical relationships
 * between database format and React Flow format.
 */

import { PARENT_CHILD_EDGE_TYPE, ParentChildEdgeData, HierarchicalNodeData } from './hierarchy.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Edge as RFEdge, Node as RFNode } from "@xyflow/react";
import { Relationship as Neo4jRelationship } from "neo4j-driver";

/**
 * Transform a hierarchical node from Neo4j format to React Flow format
 * Adds hierarchical properties to any node type
 */
export function addHierarchicalProperties<T extends Record<string, unknown>>(node: GraphNode<T>): GraphNode<T & HierarchicalNodeData> {
  // Extract hierarchical properties from the node data
  const hierarchyData = node.data as unknown as HierarchicalNodeData;
  
  // Build the hierarchy relationship if data exists
  const hierarchyRelationship = {
    parentId: hierarchyData.hierarchy?.parentId || null,
    childIds: hierarchyData.hierarchy?.childIds || [],
    isRollup: hierarchyData.hierarchy?.isRollup !== false, // Default to true
  };
  
  // Create a new node with hierarchical properties
  return {
    ...node,
    data: {
      ...node.data,
      hierarchy: hierarchyRelationship,
      originalEstimate: hierarchyData.originalEstimate,
      rollupEstimate: hierarchyData.rollupEstimate
    } as T & HierarchicalNodeData
  };
}

/**
 * Transform a Neo4j edge into a React Flow edge for hierarchical relationships
 */
export function neo4jToReactFlowEdge(neo4jEdge: GraphEdge): RFEdge {
  console.log('[Transform] Converting Neo4j hierarchical edge to React Flow edge:', {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  });
  
  // Convert the edge to React Flow format
  return {
    id: neo4jEdge.id,
    source: neo4jEdge.from,
    target: neo4jEdge.to,
    type: 'default', // Always use default for rendering
    data: {
      label: neo4jEdge.properties?.label || 'Parent-Child',
      edgeType: PARENT_CHILD_EDGE_TYPE.toLowerCase(),
      rollupContribution: neo4jEdge.properties?.rollupContribution !== false, // Default to true
      weight: neo4jEdge.properties?.weight || 1
    },
  };
}

/**
 * Transform a React Flow edge into a Neo4j edge for hierarchical relationships
 */
export function reactFlowToNeo4jEdge(rfEdge: RFEdge): GraphEdge {
  return {
    id: rfEdge.id,
    from: rfEdge.source,
    to: rfEdge.target,
    type: PARENT_CHILD_EDGE_TYPE,
    properties: {
      rollupContribution: rfEdge.data?.rollupContribution !== false, // Default to true
      weight: rfEdge.data?.weight || 1,
      label: rfEdge.data?.label || 'Parent-Child'
    }
  };
}

/**
 * Transform a Neo4j relationship into a GraphEdge for hierarchical relationships
 */
export function transformHierarchyEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge {
  if (!relationship.properties) {
    // If no properties exist, create minimal edge data
    return {
      id: `hierarchical-edge-${crypto.randomUUID()}`,
      from: sourceId || relationship.start.toString(),
      to: targetId || relationship.end.toString(),
      type: PARENT_CHILD_EDGE_TYPE,
      properties: {
        label: 'Parent-Child',
        rollupContribution: true,
        weight: 1
      }
    };
  }

  return {
    id: relationship.properties.id as string || `hierarchical-edge-${crypto.randomUUID()}`,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: PARENT_CHILD_EDGE_TYPE, // Normalize the type to PARENT_CHILD even if it was SOURCE
    properties: {
      ...relationship.properties,
      label: relationship.properties.label as string || 'Parent-Child',
      rollupContribution: relationship.properties.rollupContribution !== false, // Default to true
      weight: relationship.properties.weight as number || 1 // Default weight is 1
    }
  };
} 