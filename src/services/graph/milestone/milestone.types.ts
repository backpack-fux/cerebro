import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";
import { NodeStatus } from "@/hooks/useNodeStatus";

// KPI type for milestone metrics
export type KPI = {
  id: string;
  name: string;
  target: number;
  unit: string;
};

// Frontend types for React Flow
export interface RFMilestoneNodeData extends ReactFlowNodeBase {
  title: string;
  description?: string;
  status?: NodeStatus;
  kpis?: KPI[];
  position?: XYPosition;
}

export interface RFMilestoneNode extends Node<RFMilestoneNodeData> {}

// Service types for Neo4j operations
export type CreateMilestoneNodeParams = {
  title: string;
  description?: string;
  status?: NodeStatus;
  kpis?: KPI[];
  position: XYPosition;
};

interface UpdatableMilestoneNodeData {
  title?: string;
  description?: string;
  status?: NodeStatus;
  kpis?: KPI[];
  position?: XYPosition;
}

export type UpdateMilestoneNodeParams = UpdatableMilestoneNodeData & {
  id: string;
};

// Backend types for Neo4j operations
export interface Neo4jMilestoneNodeData {
  id: string; // String ID for React Flow compatibility
  name: string;
  description?: string;
  title: string;
  status?: string;
  kpis?: string; // Stored as JSON string in Neo4j
  createdAt: string;
  updatedAt: string;
  positionX: number;
  positionY: number;
}

// Edge types for milestone connections
export interface RFMilestoneEdge extends RFEdge {
  type?: 'dependency' | 'related' | string; // Custom edge types for MilestoneNode connections
  source: string;
  target: string;
  data?: {
    label?: string; // Optional label for display in UI
    edgeType?: string; // Original edge type from Neo4j
  };
}

export interface Neo4jMilestoneEdge {
  id: string; // Unique string ID for the edge
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'DEPENDENCY' | 'RELATED' | string; // Uppercase for Neo4j convention
  properties?: {
    label?: string; // Optional label for display
    createdAt?: string; // Optional timestamp for tracking creation
    updatedAt?: string; // Optional timestamp for tracking updates
  };
} 