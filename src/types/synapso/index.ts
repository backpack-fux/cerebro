import { XYPosition } from '@xyflow/react';

// Re-export all node types
export * from './nodes';
import { WorkflowNode } from './nodes';

/**
 * Edge between nodes in a workflow
 */
export interface Edge {
  id: string;
  workflowId: string;
  source: string;
  target: string;
  data?: Record<string, any>;
  type?: string;
  createdAt: string;
  updatedAt: string;
  label?: string;
}

/**
 * Canvas data for a workflow
 */
export interface Canvas {
  id: string;
  workflowId: string;
  viewport?: { x: number; y: number; zoom: number };
  backgroundType?: string;
  backgroundPattern?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

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
  nodes?: WorkflowNode[];
  edges?: Edge[];
  canvas?: Canvas;
  metadata?: Record<string, any>;
}

/**
 * Workflow status
 */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

/**
 * Agent information
 */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: string;
  config?: Record<string, any>;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

/**
 * Event data
 */
export interface Event {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data?: Record<string, any>;
}

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  eventTypes: string[];
  callback: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';
}

/**
 * Real-time event with subscription information
 */
export interface RealTimeEvent<T = any> {
  event: Event;
  subscriptionId?: string;
  data: T;
} 