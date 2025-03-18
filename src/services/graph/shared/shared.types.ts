// src/services/graph/shared/shared.types.ts

// Common types shared across multiple components

/**
 * Role type for team members
 * Represents a role that a team member can have within a team
 */
export type Role = string;

/**
 * Base roles that are available by default
 */
export const BASE_ROLES = [
  'Developer',
  'Designer',
  'Product Manager',
  'Project Manager',
  'QA Engineer',
  'DevOps Engineer',
  'Technical Writer',
  'UX Researcher'
] as const;

/**
 * Core status types for node state management
 * Used across multiple node types and hooks
 */
export type NodeStatus = 'planning' | 'in_progress' | 'completed' | 'active';

/**
 * Configuration for status-aware hooks
 */
export type NodeStatusConfig = {
  canBeActive?: boolean;
  defaultStatus?: NodeStatus;
  statusMap?: Partial<Record<NodeStatus, string>>;
};

/**
 * Duration input configuration for useDurationInput hook
 */
export type DurationConfig = {
  maxDays: number;
  label: string;
  fieldName: string;
  tip?: string;
  snapValues?: number[];
};

/**
 * Base node data structure for all node types
 */
export type BaseNodeData<T extends string = string> = {
  id: string;
  type: T;
  position: { x: number; y: number };
  status?: NodeStatus;
  // ... other common fields ...
};

/**
 * Connection metadata for node relationships
 */
export type NodeConnection = {
  source: string;
  target: string;
  label?: string;
  dataType?: 'dependency' | 'dataflow' | 'hierarchy';
};