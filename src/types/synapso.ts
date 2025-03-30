/**
 * Type definitions for Synapso API 
 * 
 * These types define the structure of data returned from the Synapso backend service
 */

import { XYPosition } from "@xyflow/react";
import { ReactFlowId } from "@/services/graph/base-node/reactflow.types";

/**
 * Workflow state
 */
export interface WorkflowState {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Workflow status
 */
export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Workflow node
 */
export interface WorkflowNode {
  id: string;
  type: string;
  workflowId: string;
  position: XYPosition;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  status?: NodeStatus;
  metadata?: Record<string, any>;
}

/**
 * Node status
 */
export enum NodeStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
}

/**
 * Edge between nodes
 */
export interface Edge {
  id: string;
  workflowId: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  type?: string;
  data?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Canvas state for workflow visualization
 */
export interface Canvas {
  id: string;
  workflowId: string;
  viewportTransform?: {
    x: number;
    y: number;
    zoom: number;
  };
  nodePositions: Record<string, XYPosition>;
  updatedAt: string;
}

/**
 * Agent definition
 */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  capabilities: string[];
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Agent status
 */
export enum AgentStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  subscriberId: string;
  subscriberType: 'NODE' | 'AGENT' | 'WORKFLOW';
  createdAt: string;
}

/**
 * Event data
 */
export interface Event {
  id: string;
  type: string;
  source: string;
  sourceType: string;
  data: Record<string, any>;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Real-time event with subscription information
 */
export interface RealTimeEvent<T = any> {
  event: Event;
  subscriptionId?: string;
  data: T;
} 