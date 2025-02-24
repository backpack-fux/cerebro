// neo4j.provider.ts
import { Neo4jGraphStorage } from './neo4j.service';
import { Neo4jConfig } from './neo4j.configs';
import { GraphEdge, GraphNode, IGraphStorage } from './graph.interface';
import { MetaService } from '@/services/graph/meta/meta.service';
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { neo4jConfig } from './neo4j.configs';
import { transformMetaNode, transformMetaEdge } from '@/services/graph/meta/meta.transform';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function createNeo4jStorage<T>(
  config: Neo4jConfig,
  transformNode: (node: Neo4jNode) => GraphNode<T> | null,
  transformEdge: (relationship: Neo4jRelationship) => GraphEdge | null
): IGraphStorage<T> {
  return new Neo4jGraphStorage<T>(config, transformNode, transformEdge);
}

export function createMetaService(storage: IGraphStorage<RFMetaNodeData>): MetaService {
  return new MetaService(storage);
}

export const neo4jStorage = createNeo4jStorage<RFMetaNodeData>(
  neo4jConfig,
  transformMetaNode,
  transformMetaEdge
);
export const metaService = createMetaService(neo4jStorage);