import {
  NodeType,
  RelationshipType,
  ReactFlowId,
} from "@/services/graph/base-node/reactflow.types";
import { XYPosition } from "@xyflow/react";

export interface GraphNode<T> {
  id: ReactFlowId; // Now required, using Neo4j's internal ID (stringified)
  type: NodeType;
  data: T & { position?: XYPosition };
  position: XYPosition
}

export interface GraphEdge {
  id: string;
  from: ReactFlowId;
  to: ReactFlowId;
  type: RelationshipType;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode<unknown>[];
  edges: GraphEdge[];
}

export interface IGraphStorage<T = unknown> {
  // Core node operations
  getFullGraph(): Promise<GraphData>;
  createNode<N extends T>(type: NodeType, properties: N): Promise<GraphNode<N>>; // Strict properties for creation
  getNodesByType(type: NodeType): Promise<GraphNode<unknown>[]>; // Generic return for flexibility
  getNode(nodeId: ReactFlowId): Promise<GraphNode<T> | null>;
  updateNode(nodeId: ReactFlowId, properties: Partial<T>): Promise<GraphNode<T>>; // Partial for updates
  deleteNode(nodeId: ReactFlowId): Promise<void>;

  // Edge (relationship) operations
  createEdge(edge: GraphEdge): Promise<GraphEdge>;
  getEdges(nodeId: ReactFlowId, type?: RelationshipType): Promise<GraphEdge[]>;
  getEdge(edgeId: string): Promise<GraphEdge | null>;
  updateEdge(edgeId: string, properties: Partial<GraphEdge['properties']>): Promise<GraphEdge>;
  deleteEdge(edgeId: string): Promise<void>;
  
  // Graph-wide operations
  resetGraph(): Promise<void>;

  // Lifecycle methods
  close(): Promise<void>;
}