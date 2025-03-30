import { XYPosition } from "@xyflow/react";
import { RosterMember, Season } from "@/services/graph/team/team.types";

/**
 * Base node interface for all Synapso nodes
 */
export interface BaseSynapsoNodeData {
  id: string;
  title: string;
  description?: string;
  type: string;
  workflowId: string;
}

/**
 * Team node specific data
 */
export interface SynapsoTeamNodeData extends BaseSynapsoNodeData {
  roster?: RosterMember[];
  season?: Season;
}

/**
 * Logic node specific data
 */
export interface SynapsoLogicNodeData extends BaseSynapsoNodeData {
  logic?: string;
}

/**
 * Team member node specific data
 */
export interface SynapsoTeamMemberNodeData extends BaseSynapsoNodeData {
  role?: string;
  weeklyCapacity?: number;
}

/**
 * Union type of all node data types
 */
export type SynapsoNodeData = 
  | SynapsoTeamNodeData 
  | SynapsoLogicNodeData 
  | SynapsoTeamMemberNodeData;

/**
 * Complete workflow node type with position and data
 */
export interface WorkflowNode {
  id: string;
  type: string;
  workflowId: string;
  position: XYPosition;
  data: SynapsoNodeData;
  createdAt: string;
  updatedAt: string;
  status?: NodeStatus;
  metadata?: Record<string, any>;
}

/**
 * Node status types
 */
export type NodeStatus = 
  | 'idle' 
  | 'running' 
  | 'success' 
  | 'error' 
  | 'waiting'; 