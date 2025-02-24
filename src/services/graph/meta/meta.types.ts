import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";

// NODE TYPES HERE

// Frontend types for React Flow
export interface RFMetaNodeData extends ReactFlowNodeBase {
  title: string;
  description?: string;
  position?: XYPosition;
}

export interface RFMetaNode extends Node<RFMetaNodeData> {}

// Service types for Neo4j operations
export type CreateMetaNodeParams = {
  title: string;
  description?: string;
  position: XYPosition;
};

interface UpdatableMetaNodeData {
    title?: string;
    description?: string;
    position?: XYPosition;
}

export type UpdateMetaNodeParams = UpdatableMetaNodeData & {
  id: string;
};

// Backend types for Neo4j operations
// neo4j.types.ts or similar
export interface Neo4jMetaNodeData {
    id: string; // String ID for React Flow compatibility
    name: string;
    description?: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    positionX: number;
    positionY: number;
}

// EDGE TYPES HERE
export interface RFMetaEdge extends RFEdge {
    type?: 'knowledge' | 'roadmap' | string; // Custom edge types for MetaNode connections
    source: string;
    target: string;
    data?: {
      label?: string; // Optional label for display in UI
      // Add other metadata as needed (e.g., weight, timestamp)
    };
}

export interface Neo4jMetaEdge {
    id: string; // Unique string ID for the edge (e.g., 'edge-1')
    from: string; // Source node ID (string, e.g., 'meta-1')
    to: string; // Target node ID (string, e.g., 'meta-2')
    type: 'KNOWLEDGE_BASE' | 'ROADMAP' | string; // Uppercase for Neo4j convention
    properties?: {
      label?: string; // Optional label for display
      createdAt?: string; // Optional timestamp for tracking creation
      updatedAt?: string; // Optional timestamp for tracking updates
      // Add other metadata as needed
    };
}