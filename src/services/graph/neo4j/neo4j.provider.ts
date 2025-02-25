// neo4j.provider.ts
import { Neo4jGraphStorage } from './neo4j.service';
import { Neo4jConfig } from './neo4j.configs';
import { GraphEdge, GraphNode, IGraphStorage } from './graph.interface';
import { MetaService } from '@/services/graph/meta/meta.service';
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { neo4jConfig } from './neo4j.configs';
import { transformMetaNode, transformMetaEdge } from '@/services/graph/meta/meta.transform';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { NodeType } from '../base-node/reactflow.types';
import { MilestoneService } from '@/services/graph/milestone/milestone.service';
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { transformMilestoneNode, transformMilestoneEdge } from '@/services/graph/milestone/milestone.transform';

// Generic transform functions for any node/edge type (could be dynamic or default)
function transformNode(node: Neo4jNode): GraphNode<any> | null {
  if (!node?.properties) return null;

  const type = node.labels[0]?.toLowerCase() as NodeType;
  if (!type) return null;

  const { positionX, positionY, id, ...properties } = node.properties;

  return {
    id: id as string,
    type,
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: properties as any, // Generic, could be refined with dynamic type detection
  };
}

function transformEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  return {
    id: relationship.properties.id as string || `edge-${crypto.randomUUID()}`,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: relationship.properties || {},
  };
}

export function createNeo4jStorage<T>(
  config: Neo4jConfig,
  transformNode: (node: Neo4jNode) => GraphNode<T> | null,
  transformEdge: (relationship: Neo4jRelationship, sourceId?: string, targetId?: string) => GraphEdge | null
): IGraphStorage<T> {
  return new Neo4jGraphStorage<T>(config, transformNode, transformEdge);
}

// Create a generic Neo4j storage instance
export const neo4jStorage = createNeo4jStorage<any>(
  neo4jConfig,
  transformNode,
  transformEdge
);

// Create a MetaService instance with the Neo4j storage
export const metaService = createMetaService(neo4jStorage as IGraphStorage<RFMetaNodeData>);

// Create a MilestoneService instance with the Neo4j storage
export const milestoneService = createMilestoneService(neo4jStorage as IGraphStorage<RFMilestoneNodeData>);

// Factory function for creating a MetaService instance
export function createMetaService(storage: IGraphStorage<RFMetaNodeData>): MetaService {
  return new MetaService(storage);
}

// Factory function for creating a MilestoneService instance
export function createMilestoneService(storage: IGraphStorage<RFMilestoneNodeData>): MilestoneService {
  return new MilestoneService(storage);
}

// Create a specialized Neo4j storage for Meta nodes
export function createMetaStorage(): IGraphStorage<RFMetaNodeData> {
  return createNeo4jStorage<RFMetaNodeData>(
    neo4jConfig,
    transformMetaNode,
    transformMetaEdge
  );
}

// Create a specialized Neo4j storage for Milestone nodes
export function createMilestoneStorage(): IGraphStorage<RFMilestoneNodeData> {
  return createNeo4jStorage<RFMilestoneNodeData>(
    neo4jConfig,
    transformMilestoneNode,
    transformMilestoneEdge
  );
}