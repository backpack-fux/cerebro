import { Node, XYPosition, Edge as RFEdge } from "@xyflow/react";
import { ReactFlowNodeBase } from "@/services/graph/base-node/reactflow.types";
import { Role, BASE_ROLES } from "@/services/graph/shared/shared.types";

// Common timezones - can be expanded
export const TIMEZONES = [
  'UTC-8 (PST)',
  'UTC-7 (MST)',
  'UTC-6 (CST)',
  'UTC-5 (EST)',
  'UTC+0 (GMT)',
  'UTC+1 (CET)',
  'UTC+2 (EET)',
  'UTC+5:30 (IST)',
  'UTC+8 (CST)',
  'UTC+9 (JST)',
  'UTC+10 (AEST)',
] as const;

// Default date constants
export const DEFAULT_START_DATE = '2025-01-01';
export const EARLIEST_START_DATE = '2020-01-01';

// Re-export Role and BASE_ROLES for backward compatibility
export type { Role };
export { BASE_ROLES };

// Team allocation interface
export interface TeamAllocation {
  teamId: string;
  percentage: number;
}

// Frontend types for React Flow
export interface RFTeamMemberNodeData extends ReactFlowNodeBase {
  title: string;
  name: string; // Required by ReactFlowNodeBase
  description?: string; // Optional in ReactFlowNodeBase
  createdAt: string; // Required by ReactFlowNodeBase
  updatedAt: string; // Required by ReactFlowNodeBase
  roles: Role[];
  bio?: string;
  timezone?: string;
  hourlyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
  startDate?: string;
  skills?: string[];
  teamId?: string;
  allocation?: number;
  position?: XYPosition;
}

// This interface extends Node with RFTeamMemberNodeData to create a specific node type
// It's not empty - it's inheriting all properties from Node<RFTeamMemberNodeData>
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RFTeamMemberNode extends Node<RFTeamMemberNodeData> {}

// Summary data structure for team member
export interface TeamMemberSummary {
  id: string;
  weeklyCapacity: number;
  dailyRate: number;
  roles: Role[];
  allocation: number;
}

// Service types for Neo4j operations
export type CreateTeamMemberNodeParams = {
  title: string;
  roles?: Role[];
  bio?: string;
  timezone?: string;
  dailyRate?: number;
  hoursPerDay?: number;
  daysPerWeek?: number;
  weeklyCapacity?: number;
  startDate?: string;
  skills?: string[];
  position: XYPosition;
};

interface UpdatableTeamMemberNodeData {
  title?: string;
  roles?: Role[];
  bio?: string;
  timezone?: string;
  dailyRate?: number;
  hoursPerDay?: number;
  daysPerWeek?: number;
  weeklyCapacity?: number;
  startDate?: string;
  skills?: string[];
  teamId?: string;
  allocation?: number;
  position?: XYPosition;
}

export type UpdateTeamMemberNodeParams = UpdatableTeamMemberNodeData & {
  id: string;
};

// Backend types for Neo4j operations
export interface Neo4jTeamMemberNodeData {
  id: string;
  name: string;
  title: string;
  roles: string; // Stored as JSON string in Neo4j
  bio?: string;
  timezone?: string;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity: number;
  startDate?: string;
  skills?: string; // Stored as JSON string in Neo4j
  teamId?: string;
  allocation?: number;
  createdAt: string;
  updatedAt: string;
  positionX: number;
  positionY: number;
}

// Edge types for team member connections
export interface RFTeamMemberEdge extends RFEdge {
  type?: 'team' | 'collaboration' | string; // Custom edge types for TeamMemberNode connections
  source: string;
  target: string;
  data?: {
    label?: string; // Optional label for display in UI
    edgeType?: string; // Original edge type from Neo4j
    memberSummary?: TeamMemberSummary; // Summary data for the team member
    allocation?: number; // Allocation percentage for team members
    role?: string; // Role of the team member in the team
  };
}

export interface Neo4jTeamMemberEdge {
  id: string; // Unique string ID for the edge
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'TEAM' | 'COLLABORATION' | string; // Uppercase for Neo4j convention
  properties?: {
    label?: string; // Optional label for display
    memberSummary?: string; // JSON string of TeamMemberSummary
    createdAt?: string; // Optional timestamp for tracking creation
    updatedAt?: string; // Optional timestamp for tracking updates
    allocation?: number; // Allocation percentage for team members
    role?: string; // Role of the team member in the team
  };
}

// API request/response types (for compatibility with existing code)
export interface TeamMemberResponse {
  id: string;
  data: RFTeamMemberNodeData;
  position?: XYPosition;
  type: 'teamMember';
}

export type TeamMemberCreateRequest = CreateTeamMemberNodeParams;
export type TeamMemberUpdateRequest = UpdatableTeamMemberNodeData;
