import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";

// NODE TYPES HERE

// Basic types for feature nodes
export type BuildType = 'internal' | 'external';
export type TimeUnit = 'days' | 'weeks';

// Member allocation type for feature nodes
export interface MemberAllocation {
  memberId: string;
  timePercentage: number;
}

// Team allocation type for feature nodes
export interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: { memberId: string; name?: string; hours: number; hoursPerDay?: number }[];
}

// Available bandwidth type for feature nodes
export interface AvailableBandwidth {
  memberId: string;
  dailyRate: number;
}

// Frontend types for React Flow
export interface RFFeatureNodeData extends ReactFlowNodeBase {
  title: string;
  description?: string;
  buildType?: BuildType;
  cost?: number;
  duration?: number;
  timeUnit?: TimeUnit;
  teamMembers?: string[]; // Array of team member node IDs
  memberAllocations?: MemberAllocation[];
  teamAllocations?: TeamAllocation[];
  availableBandwidth?: AvailableBandwidth[];
  status?: string; // For tracking planning, in-progress, completed, etc.
  position?: XYPosition;
}

export interface RFFeatureNode extends Node<RFFeatureNodeData> {}

// Service types for Neo4j operations
export type CreateFeatureNodeParams = {
  title: string;
  description?: string;
  buildType?: BuildType;
  duration?: number;
  timeUnit?: TimeUnit;
  status?: string;
  position: XYPosition;
};

interface UpdatableFeatureNodeData {
  title?: string;
  description?: string;
  buildType?: BuildType;
  cost?: number;
  duration?: number;
  timeUnit?: TimeUnit;
  teamMembers?: string[];
  memberAllocations?: MemberAllocation[];
  teamAllocations?: TeamAllocation[];
  status?: string;
  position?: XYPosition;
}

export type UpdateFeatureNodeParams = UpdatableFeatureNodeData & {
  id: string;
};

// Backend types for Neo4j operations
export interface Neo4jFeatureNodeData {
  id: string; // String ID for React Flow compatibility
  name: string;
  description?: string;
  title: string;
  buildType?: string;
  cost?: number;
  duration?: number;
  timeUnit?: string;
  teamMembers?: string; // JSON string of team member IDs
  memberAllocations?: string; // JSON string of MemberAllocation array
  teamAllocations?: string; // JSON string of TeamAllocation array
  status?: string;
  createdAt: string;
  updatedAt: string;
  positionX: number;
  positionY: number;
}

// EDGE TYPES HERE
export interface RFFeatureEdge extends RFEdge {
  source: string;
  target: string;
  data?: {
    label?: string; // Optional label for display in UI
    edgeType?: string; // Original edge type from Neo4j
    allocation?: number; // Allocation percentage or hours
    // Add other metadata as needed
  };
}

export interface Neo4jFeatureEdge {
  id: string; // Unique string ID for the edge
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'FEATURE_TEAM' | 'FEATURE_MEMBER' | 'FEATURE_DEPENDENCY' | string; // Edge types for feature connections
  properties?: {
    label?: string; // Optional label for display
    createdAt?: string; // Optional timestamp for tracking creation
    updatedAt?: string; // Optional timestamp for tracking updates
    allocation?: number; // Allocation percentage or hours
    // Add other metadata as needed
  };
} 