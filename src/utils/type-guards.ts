import { Node } from '@xyflow/react';

// Define common node data types
export interface TeamNodeData extends Record<string, unknown> {
  title: string;
  roster: Array<any>;
  season?: {
    startDate: string;
    endDate: string;
    name: string;
  };
}

export interface MemberNodeData extends Record<string, unknown> {
  title: string;
  weeklyCapacity: number;
  dailyRate?: number;
  hoursPerDay: number;
  daysPerWeek: number;
  startDate?: string;
}

export interface FeatureNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<any> | string;
  duration?: number;
  startDate?: string;
  endDate?: string;
}

export interface OptionNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<any> | string;
  duration?: number;
  startDate?: string;
  endDate?: string;
}

export interface ProviderNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  teamAllocations?: Array<any> | string;
  duration?: number;
  costs?: Array<any>;
  ddItems?: Array<any>;
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
 */
export function isOfType<T>(
  value: any, 
  propertyNames: Array<keyof T>
): value is T {
  if (!value || typeof value !== 'object') return false;
  
  return propertyNames.every(prop => 
    prop in value
  );
} 