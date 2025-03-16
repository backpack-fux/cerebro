import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";

// NODE TYPES HERE

// Basic types for option nodes
export type OptionType = 'customer' | 'contract' | 'partner';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type SeverityLevel = 'high' | 'medium' | 'low';

// Goal type for option nodes
export type Goal = {
  id: string;
  description: string;
  impact: ImpactLevel;
};

// Risk type for option nodes
export type Risk = {
  id: string;
  description: string;
  severity: SeverityLevel;
  mitigation?: string;
};

// Member allocation type for option nodes
export interface MemberAllocation {
  memberId: string;
  timePercentage: number;
}

// Team allocation type for option nodes
export interface TeamAllocation {
  teamId: string;
  teamName?: string;
  requestedHours: number;
  allocatedMembers: Array<{
    memberId: string;
    name?: string;
    hours: number;
    availableHours?: number;
  }>;
  teamBandwidth?: number;
  availableBandwidth?: number;
}

// Frontend types for React Flow
export interface RFOptionNodeData extends ReactFlowNodeBase {
  title: string;
  description?: string;
  optionType?: OptionType;
  transactionFeeRate?: number;
  monthlyVolume?: number;
  duration?: number;
  teamMembers?: string[];
  memberAllocations?: MemberAllocation[];
  goals: Goal[];
  risks: Risk[];
  buildDuration?: number;
  timeToClose?: number;
  teamAllocations?: TeamAllocation[];
  status?: string; // For tracking planning, in-progress, completed, etc.
  position?: XYPosition;
}

export interface RFOptionNode extends Node<RFOptionNodeData> {}

// Service types for Neo4j operations
export type CreateOptionNodeParams = {
  title: string;
  description?: string;
  optionType?: OptionType;
  duration?: number;
  goals?: Goal[];
  risks?: Risk[];
  status?: string;
  position: XYPosition;
};

interface UpdatableOptionNodeData {
  title?: string;
  description?: string;
  optionType?: OptionType;
  transactionFeeRate?: number;
  monthlyVolume?: number;
  duration?: number;
  teamMembers?: string[];
  memberAllocations?: MemberAllocation[];
  goals?: Goal[];
  risks?: Risk[];
  buildDuration?: number;
  timeToClose?: number;
  teamAllocations?: TeamAllocation[];
  status?: string;
  position?: XYPosition;
}

export type UpdateOptionNodeParams = UpdatableOptionNodeData & {
  id: string;
};

// Backend types for Neo4j operations
export interface Neo4jOptionNodeData {
  id: string; // String ID for React Flow compatibility
  name: string;
  description?: string;
  title: string;
  optionType?: string;
  transactionFeeRate?: number;
  monthlyVolume?: number;
  duration?: number;
  teamMembers?: string; // JSON string of team member IDs
  memberAllocations?: string; // JSON string of MemberAllocation array
  goals?: string; // JSON string of Goal array
  risks?: string; // JSON string of Risk array
  buildDuration?: number;
  timeToClose?: number;
  teamAllocations?: string; // JSON string of TeamAllocation array
  status?: string;
  createdAt: string;
  updatedAt: string;
  positionX: number;
  positionY: number;
}

// EDGE TYPES HERE
export interface RFOptionEdge extends RFEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: {
    label?: string;
    edgeType?: string;
    allocation?: number;
    requestedHours?: number;
    allocatedMembers?: Array<{
      memberId: string;
      name?: string;
      hours: number;
    }>;
  };
}

export interface Neo4jOptionEdge {
  id: string; // Unique string ID for the edge
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'OPTION_TEAM' | 'OPTION_MEMBER' | 'OPTION_DEPENDENCY' | string; // Edge types for option connections
  properties?: {
    label?: string; // Optional label for display
    createdAt?: string; // Optional timestamp for tracking creation
    updatedAt?: string; // Optional timestamp for tracking updates
    allocation?: number; // Allocation percentage or hours
    // Add other metadata as needed
  };
} 