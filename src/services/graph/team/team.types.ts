import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";
import { Role } from "@/services/graph/shared/shared.types";

// NODE TYPES HERE

// Season type for team nodes
export type Season = {
  startDate: string;
  endDate: string;
  name: string;
  goals?: string[];
};

// Roster member type for team nodes
export type RosterMember = {
  memberId: string;
  allocation: number; // Total percentage of member's time allocated to this team
  role: Role;
  startDate?: string;
  endDate?: string;
  allocations?: {
    nodeId: string; // ID of feature/provider/option
    percentage: number; // Percentage of their team allocation
  }[];
};

// Frontend types for React Flow
export interface RFTeamNodeData extends ReactFlowNodeBase {
  title: string;
  description?: string;
  season?: Season;
  roster: RosterMember[]; // Array of team members
  position?: XYPosition;
}

export interface RFTeamNode extends Node<RFTeamNodeData> {}

// Service types for Neo4j operations
export type CreateTeamNodeParams = {
  title: string;
  description?: string;
  season?: Season;
  roster?: RosterMember[];
  position: XYPosition;
};

interface UpdatableTeamNodeData {
  title?: string;
  description?: string;
  season?: Season;
  roster?: RosterMember[];
  position?: XYPosition;
}

export type UpdateTeamNodeParams = UpdatableTeamNodeData & {
  id: string;
};

// Backend types for Neo4j operations
export interface Neo4jTeamNodeData {
  id: string; // String ID for React Flow compatibility
  name: string;
  description?: string;
  title: string;
  season?: string; // JSON string of Season object
  roster?: string; // JSON string of RosterMember array
  createdAt: string;
  updatedAt: string;
  positionX: number;
  positionY: number;
}

// EDGE TYPES HERE
export interface RFTeamEdge extends RFEdge {
  source: string;
  target: string;
  data?: {
    label?: string; // Optional label for display in UI
    edgeType?: string; // Original edge type from Neo4j
    allocation?: number; // Allocation percentage for team members
    // Add other metadata as needed
  };
}

export interface Neo4jTeamEdge {
  id: string; // Unique string ID for the edge
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'TEAM_MEMBER' | 'TEAM_FEATURE' | string; // Edge types for team connections
  properties?: {
    label?: string; // Optional label for display
    createdAt?: string; // Optional timestamp for tracking creation
    updatedAt?: string; // Optional timestamp for tracking updates
    allocation?: number; // Allocation percentage for team members
    // Add other metadata as needed
  };
} 