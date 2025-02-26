// neo4j.service.ts
// Prevent client-side instantiation
if (typeof window !== 'undefined') {
    throw new Error('Neo4jGraphStorage cannot be used on the client side');
  }
  
import neo4j, { Driver, Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { IGraphStorage, GraphNode, GraphEdge, GraphData } from './graph.interface';
import { NodeType, ReactFlowId } from '../base-node/reactflow.types';
import { Neo4jConfig } from './neo4j.configs';
import { CYPHER_QUERIES } from './cypher.configs';
import { XYPosition } from '@xyflow/react';
  
/**
 * Helper function to sanitize node types for Neo4j labels
 * Converts spaces, periods, and hyphens to underscores
 * @param type The node type to sanitize
 * @returns The sanitized node type suitable for Neo4j labels
 */
function sanitizeNodeType(type: string): string {
  // Convert to uppercase and replace spaces, periods, and hyphens with underscores
  return type.toUpperCase().replace(/[\s\.-]/g, '_');
}
  
export class Neo4jGraphStorage<T> implements IGraphStorage<T> {
  private driver: Driver;
  private transformNodeFn: (node: Neo4jNode) => GraphNode<T> | null;
  private transformEdgeFn: (relationship: Neo4jRelationship, sourceId?: string, targetId?: string) => GraphEdge | null;

  constructor(
    config: Neo4jConfig, 
    transformNode: (node: Neo4jNode) => GraphNode<T> | null,
    transformEdge: (relationship: Neo4jRelationship, sourceId?: string, targetId?: string) => GraphEdge | null
  ) {
      this.driver = neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.username, config.password),
        {
          encrypted: config.encrypted ?? (process.env.NODE_ENV === 'production'),
          trust: config.trust || 'TRUST_ALL_CERTIFICATES',
        }
      );
      this.transformNodeFn = transformNode;
      this.transformEdgeFn = transformEdge;
  }

  async getFullGraph(): Promise<GraphData> {
  const session = this.driver.session();
  try {
    const result = await session.run(CYPHER_QUERIES.GET_FULL_GRAPH);
    const nodes: GraphNode<any>[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode<any>>();

    result.records.forEach(record => {
      const node = record.get('n') as Neo4jNode;
      if (node) {
        const transformed = this.transformNode(node);
        if (transformed && !nodeMap.has(transformed.id)) {
          nodeMap.set(transformed.id, transformed);
          nodes.push(transformed);
        }
      }

      const relationship = record.get('r') as Neo4jRelationship;
      if (relationship) {
        const sourceId = record.get('sourceId') as string;
        const targetId = record.get('targetId') as string;
        const transformedEdge = this.transformEdge(relationship, sourceId, targetId);
        if (transformedEdge) edges.push(transformedEdge);
      }
    });

    return { nodes, edges };
  } finally {
    await session.close();
  }
  }

  async createNode<N extends T>(type: NodeType, properties: N): Promise<GraphNode<N>> {
    const session = this.driver.session();
    const now = new Date().toISOString();
    try {
      const position = (properties as N & { position?: XYPosition }).position || { x: 0, y: 0 };
      
      // Replace TYPE_PLACEHOLDER with the sanitized type
      const query = CYPHER_QUERIES.CREATE_NODE.replace('TYPE_PLACEHOLDER', sanitizeNodeType(type));
      
      const result = await session.run(query, {
        id: crypto.randomUUID(),
        positionX: position.x,
        positionY: position.y,
        createdAt: now,
        updatedAt: now,
        properties,
      });
  
      const node = result.records[0].get('n') as Neo4jNode;
      return this.transformNode(node) as GraphNode<N>;
    } finally {
      await session.close();
    }
  }

  async getNodesByType(type: NodeType): Promise<GraphNode<any>[]> {
    const session = this.driver.session();
    try {
      // Replace TYPE_PLACEHOLDER with the sanitized type
      const query = CYPHER_QUERIES.GET_NODES_BY_TYPE.replace('TYPE_PLACEHOLDER', sanitizeNodeType(type));
      const result = await session.run(query);

      return result.records
        .map(record => {
          const node = record.get('n') as Neo4jNode<any>;
          return this.transformNode(node);
        })
        .filter((node): node is GraphNode<any> => node !== null);
    } finally {
      await session.close();
    }
  }

  async getNode(nodeId: ReactFlowId): Promise<GraphNode<T> | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
          CYPHER_QUERIES.GET_NODE_BY_ID,
        { id: nodeId }
      );

      const node = result.records[0]?.get('n') as Neo4jNode | undefined;
      if (!node) return null;
      return this.transformNode(node) as GraphNode<T>;
    } finally {
      await session.close();
    }
  }

  async updateNode(nodeId: ReactFlowId, properties: Partial<T>): Promise<GraphNode<T>> {
    const session = this.driver.session();
    const now = new Date().toISOString();
    try {
      // Get the current node to preserve existing position if not provided
      const currentNode = await this.getNode(nodeId);
      if (!currentNode) {
        throw new Error(`Node with ID ${nodeId} not found`);
      }
      
      // Extract position from properties if it exists
      const position = (properties as Partial<T> & { position?: XYPosition }).position;
      
      // Use current position if not provided in the update
      const positionX = position?.x !== undefined ? position.x : currentNode.position.x;
      const positionY = position?.y !== undefined ? position.y : currentNode.position.y;
      
      console.log(`[Neo4jService] Updating node ${nodeId} with position:`, { positionX, positionY });
      
      // Remove position from properties to avoid Neo4j error with complex objects
      const cleanProperties = { ...properties };
      if ((cleanProperties as any).position) {
        delete (cleanProperties as any).position;
      }
      
      const result = await session.run(CYPHER_QUERIES.UPDATE_NODE, {
        id: nodeId,
        updatedAt: now,
        positionX,
        positionY,
        properties: cleanProperties,
      });
  
      const node = result.records[0].get('n') as Neo4jNode;
      return this.transformNode(node) as GraphNode<T>;
    } finally {
      await session.close();
    }
  }

  async deleteNode(nodeId: ReactFlowId): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
          CYPHER_QUERIES.DELETE_NODE,
        { id: nodeId }
      );
    } finally {
      await session.close();
    }
  }

  async createEdge(edge: GraphEdge): Promise<GraphEdge> {
    const session = this.driver.session();
    const now = new Date().toISOString();
    try {
      const edgeId = edge.id || `edge-${crypto.randomUUID()}`;
      
      // Replace TYPE_PLACEHOLDER with the sanitized type
      const query = CYPHER_QUERIES.CREATE_EDGE.replace('TYPE_PLACEHOLDER', sanitizeNodeType(edge.type));
      
      const result = await session.run(
        query,
        {
          from: edge.from,
          to: edge.to,
          id: edgeId,
          createdAt: now,
          updatedAt: now,
          properties: edge.properties || {},
        }
      );
  
      const relationship = result.records[0].get('r') as Neo4jRelationship;
      return {
        id: relationship.properties.id as string,
        from: edge.from,
        to: edge.to,
        type: relationship.type,
        properties: relationship.properties,
      };
    } finally {
      await session.close();
    }
  }

  async getEdges(nodeId: ReactFlowId, type?: string): Promise<GraphEdge[]> {
    const session = this.driver.session();
    try {
      // Use the centralized query from CYPHER_QUERIES
      const result = await session.run(
        CYPHER_QUERIES.GET_EDGES,
        { nodeId, type }
      );

      return result.records
        .map(record => {
          const relationship = record.get('r') as Neo4jRelationship;
          const sourceId = record.get('sourceId') as string;
          const targetId = record.get('targetId') as string;
          return this.transformEdge(relationship, sourceId, targetId);
        })
        .filter((edge): edge is GraphEdge => edge !== null);
    } finally {
      await session.close();
    }
  }

  async getEdge(edgeId: ReactFlowId): Promise<GraphEdge | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        CYPHER_QUERIES.GET_EDGE,
        { id: edgeId }
      );

      const record = result.records[0];
      if (!record) return null;
      
      const relationship = record.get('r') as Neo4jRelationship;
      const sourceId = record.get('sourceId') as string;
      const targetId = record.get('targetId') as string;
      
      return this.transformEdge(relationship, sourceId, targetId);
    } finally {
      await session.close();
    }
  }

  async updateEdge(edgeId: string, properties: Partial<GraphEdge['properties']>): Promise<GraphEdge> {
    const session = this.driver.session();
    const now = new Date().toISOString();
    try {
      const result = await session.run(
          CYPHER_QUERIES.UPDATE_EDGE,
        {
          id: edgeId,
          updatedAt: now,
          properties,
        }
      );

      const record = result.records[0];
      const relationship = record.get('r') as Neo4jRelationship;
      const sourceId = record.get('sourceId') as string;
      const targetId = record.get('targetId') as string;
      
      return {
        id: relationship.properties.id as string,
        from: sourceId,
        to: targetId,
        type: relationship.type,
        properties: {
          ...relationship.properties,
          ...properties,
          updatedAt: now,
        },
      };
    } finally {
      await session.close();
    }
  }

  async deleteEdge(edgeId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
          CYPHER_QUERIES.DELETE_EDGE,
        { id: edgeId }
      );
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  // Node transformation method
  private transformNode(node: Neo4jNode): GraphNode<T> | null {
    return this.transformNodeFn(node);
  }

  // Edge transformation method (updated to use the injected function)
  private transformEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
    return this.transformEdgeFn(relationship, sourceId, targetId);
  }

  /**
   * Reset the entire graph by deleting all nodes and relationships
   * @returns A promise that resolves when the operation is complete
   */
  async resetGraph(): Promise<void> {
    const session = this.driver.session();
    try {
      console.log('[Neo4jService] Resetting graph - deleting all nodes and relationships');
      // This Cypher query deletes all relationships and then all nodes
      await session.run('MATCH (n) DETACH DELETE n');
      console.log('[Neo4jService] Graph reset complete');
    } catch (error) {
      console.error('[Neo4jService] Error resetting graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

}