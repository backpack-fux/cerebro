// neo4j.service.ts
// Prevent client-side instantiation
if (typeof window !== 'undefined') {
    throw new Error('Neo4jGraphStorage cannot be used on the client side');
  }
  
import neo4j, { Driver, Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { IGraphStorage, GraphNode, GraphEdge, GraphData } from './graph.interface';
import { NodeType, ReactFlowId, RelationshipType } from '../base-node/reactflow.types';
import { Neo4jConfig } from './neo4j.configs';
import { CYPHER_QUERIES } from './cypher.configs';
import { XYPosition } from '@xyflow/react';
  
  export class Neo4jGraphStorage<T> implements IGraphStorage<T> {
    private driver: Driver;
    private transformNodeFn: (node: Neo4jNode) => GraphNode<T> | null;
    private transformEdgeFn: (relationship: Neo4jRelationship) => GraphEdge | null;
  
    constructor(
      config: Neo4jConfig, 
      transformNode: (node: Neo4jNode) => GraphNode<T> | null,
      transformEdge: (relationship: Neo4jRelationship) => GraphEdge | null
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

      result.records.forEach(record => {
        const node = record.get('n') as Neo4jNode;
        if (node) {
          const transformed = this.transformNode(node);
          if (transformed) nodes.push(transformed);
        }

        const relationship = record.get('r') as Neo4jRelationship;
        if (relationship) {
          const transformedEdge = this.transformEdge(relationship);
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
        const result = await session.run(CYPHER_QUERIES.CREATE_NODE, {
          type,
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
        const result = await session.run(
            CYPHER_QUERIES.GET_NODES_BY_TYPE,
          { type }
        );
  
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
        const position = (properties as Partial<T> & { position?: XYPosition }).position;
        const result = await session.run(CYPHER_QUERIES.UPDATE_NODE, {
          id: nodeId,
          updatedAt: now,
          positionX: position?.x,
          positionY: position?.y,
          properties,
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
        const result = await session.run(
          CYPHER_QUERIES.CREATE_EDGE,
          {
            from: edge.from,
            to: edge.to,
            type: edge.type,
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
  
    async getEdges(nodeId: ReactFlowId, type?: RelationshipType): Promise<GraphEdge[]> {
      const session = this.driver.session();
      try {
        const result = await session.run(
            CYPHER_QUERIES.GET_EDGES,
          { nodeId, type }
        );
  
        return result.records
        .map(record => {
          const relationship = record.get('r') as Neo4jRelationship;
          return this.transformEdge(relationship);
        })
        .filter((edge): edge is GraphEdge => edge !== null);
      } finally {
        await session.close();
      }
    }
  
    async getEdge(edgeId: string): Promise<GraphEdge | null> {
      const session = this.driver.session();
      try {
        const result = await session.run(
            CYPHER_QUERIES.GET_EDGE,
          { id: edgeId }
        );
  
        const relationship = result.records[0]?.get('r') as Neo4jRelationship | undefined;
        if (!relationship) return null;
  
        return this.transformEdge(relationship);
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
  
        const relationship = result.records[0].get('r') as Neo4jRelationship;
        return {
          id: relationship.properties.id as string,
          from: relationship.start.toString(),
          to: relationship.end.toString(),
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

    // Edge transformation method (added to match transformNode)
    private transformEdge(relationship: Neo4jRelationship): GraphEdge | null {
      return this.transformEdgeFn(relationship);
    }

    // Edge-specific transform function (to be overridden or injected per edge type)

  }