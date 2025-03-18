import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";

// NODE TYPES HERE

// Basic types for provider nodes
export type CostType = 'fixed' | 'unit' | 'revenue' | 'tiered';
export type DDStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

// Fixed cost type
export type FixedCost = {
  type: 'fixed';
  amount: number;
  frequency: 'monthly' | 'annual';
};

// Unit cost type
export type UnitCost = {
  type: 'unit';
  unitPrice: number;
  unitType: string;
  minimumUnits?: number;
  maximumUnits?: number;
};

// Revenue cost type
export type RevenueCost = {
  type: 'revenue';
  percentage: number;
  minimumMonthly?: number;
};

// Tier range type
export type TierRange = {
  min: number;
  max?: number;
  unitPrice: number;
};

// Tiered cost type
export type TieredCost = {
  type: 'tiered';
  unitType: string;
  tiers: TierRange[];
  minimumMonthly?: number;
};

// Provider cost type
export type ProviderCost = {
  id: string;
  name: string;
  costType: CostType;
  details: FixedCost | UnitCost | RevenueCost | TieredCost;
};

// Due diligence item type
export type DDItem = {
  id: string;
  name: string;
  status: DDStatus;
  notes?: string;
  dueDate?: string;
  assignee?: string; // Could be team member ID
};

// Team allocation type for provider nodes
export interface TeamAllocation {
  teamId: string;
  requestedHours: number;
  allocatedMembers: { memberId: string; hours: number }[];
}

// Frontend types for React Flow
export interface RFProviderNodeData extends ReactFlowNodeBase {
  title: string;
  description?: string;
  duration?: number;
  costs?: ProviderCost[];
  ddItems?: DDItem[];
  teamAllocations?: TeamAllocation[];
  status?: string; // For tracking planning, in-progress, completed, etc.
  position?: XYPosition;
}

// Use a type alias instead of an empty interface
export type RFProviderNode = Node<RFProviderNodeData>;

// Service types for Neo4j operations
export type CreateProviderNodeParams = {
  title: string;
  description?: string;
  duration?: number;
  status?: string;
  position: XYPosition;
};

interface UpdatableProviderNodeData {
  title?: string;
  description?: string;
  duration?: number;
  costs?: ProviderCost[];
  ddItems?: DDItem[];
  teamAllocations?: TeamAllocation[];
  status?: string;
  position?: XYPosition;
}

export type UpdateProviderNodeParams = UpdatableProviderNodeData & {
  id: string;
};

// Backend types for Neo4j operations
export interface Neo4jProviderNodeData {
  id: string; // String ID for React Flow compatibility
  name: string;
  description?: string;
  title: string;
  duration?: number;
  costs?: string; // JSON string of ProviderCost array
  ddItems?: string; // JSON string of DDItem array
  teamAllocations?: string; // JSON string of TeamAllocation array
  status?: string;
  createdAt: string;
  updatedAt: string;
  positionX: number;
  positionY: number;
}

// EDGE TYPES HERE
export interface RFProviderEdge extends RFEdge {
  source: string;
  target: string;
  data?: {
    label?: string; // Optional label for display in UI
    edgeType?: string; // Original edge type from Neo4j
    allocation?: number; // Allocation percentage or hours
    // Add other metadata as needed
  };
}

export interface Neo4jProviderEdge {
  id: string; // Unique string ID for the edge
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'PROVIDER_TEAM' | 'PROVIDER_FEATURE' | 'PROVIDER_DEPENDENCY' | string; // Edge types for provider connections
  properties?: {
    label?: string; // Optional label for display
    createdAt?: string; // Optional timestamp for tracking creation
    updatedAt?: string; // Optional timestamp for tracking updates
    allocation?: number; // Allocation percentage or hours
    // Add other metadata as needed
  };
} 