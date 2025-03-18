import { Node } from '@xyflow/react';

// Define common node data types with more specific type definitions
export interface TeamNodeData extends Record<string, unknown> {
  title: string;
  roster: Array<RosterMember>;
  season?: {
    startDate: string;
    endDate: string;
    name: string;
  };
}

// Define RosterMember type to replace Array<any>
export interface RosterMember {
  memberId: string;
  name?: string;
  weeklyCapacity?: number;
  allocation?: number;
}

export interface MemberNodeData extends Record<string, unknown> {
  title: string;
  weeklyCapacity: number;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  startDate?: string;
}

// Define TeamAllocation type to replace Array<any>
export interface TeamAllocation {
  teamId: string;
  requestedHours?: number;
  allocatedHours?: number;
  allocatedMembers?: Array<{
    memberId: string;
    hours: number;
  }>;
}

export interface FeatureNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<TeamAllocation> | string;
  duration?: number;
  startDate?: string;
  endDate?: string;
}

export interface OptionNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<TeamAllocation> | string;
  duration?: number;
  startDate?: string;
  endDate?: string;
}

// Define Cost and DDItem types to replace Array<any>
export interface Cost {
  id: string;
  name: string;
  costType: string;
  details: {
    type: string;
    amount: number;
    frequency?: string;
  };
}

export interface DDItem {
  id: string;
  name: string;
  status: string;
  notes?: string;
  dueDate?: string;
}

export interface ProviderNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<TeamAllocation> | string;
  duration?: number;
  costs?: Array<Cost>;
  ddItems?: Array<DDItem>;
}

/**
 * Type guard to check if a node is a Team node
 * @param node Node to check
 * @returns boolean indicating if the node is a Team node
 */
export function isTeamNode(node: Node | null | undefined): node is Node<TeamNodeData> {
  if (!node || node.type !== 'team' || !node.data) return false;
  const data = node.data as Partial<TeamNodeData>;
  return (
    typeof data.title === 'string' &&
    Array.isArray(data.roster)
  );
}

/**
 * Type guard to check if a node is a Team Member node
 * @param node Node to check
 * @returns boolean indicating if the node is a Team Member node
 */
export function isMemberNode(node: Node | null | undefined): node is Node<MemberNodeData> {
  if (!node || node.type !== 'teamMember' || !node.data) return false;
  const data = node.data as Partial<MemberNodeData>;
  return (
    typeof data.title === 'string' &&
    typeof data.weeklyCapacity === 'number'
  );
}

/**
 * Type guard to check if a node is a Feature node
 * @param node Node to check
 * @returns boolean indicating if the node is a Feature node
 */
export function isFeatureNode(node: Node | null | undefined): node is Node<FeatureNodeData> {
  if (!node || node.type !== 'feature' || !node.data) return false;
  const data = node.data as Partial<FeatureNodeData>;
  return typeof data.title === 'string';
}

/**
 * Type guard to check if a node is an Option node
 * @param node Node to check
 * @returns boolean indicating if the node is an Option node
 */
export function isOptionNode(node: Node | null | undefined): node is Node<OptionNodeData> {
  if (!node || node.type !== 'option' || !node.data) return false;
  const data = node.data as Partial<OptionNodeData>;
  return typeof data.title === 'string';
}

/**
 * Type guard to check if a node is a Provider node
 * @param node Node to check
 * @returns boolean indicating if the node is a Provider node
 */
export function isProviderNode(node: Node | null | undefined): node is Node<ProviderNodeData> {
  if (!node || node.type !== 'provider' || !node.data) return false;
  const data = node.data as Partial<ProviderNodeData>;
  return typeof data.title === 'string';
}

/**
 * Generic type guard for checking if a value is a specific type
 * @param value The value to check
 * @param propertyNames Array of property names that should exist on the type
 * @returns Boolean indicating if the value matches the type
 */
export function isOfType<T>(
  value: unknown, 
  propertyNames: Array<keyof T>
): value is T {
  if (!value || typeof value !== 'object') return false;
  
  return propertyNames.every(prop => 
    prop in value
  );
} 