/**
 * Synapso API Client
 * 
 * This service handles all communication with the Synapso backend service,
 * providing a centralized interface for Cerebro to interact with workflow data.
 */

import { WorkflowNode, Edge, Canvas, WorkflowState, Agent } from '@/types/synapso';

export class SynapsoClient {
  private baseUrl: string;
  private apiKey: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SYNAPSO_API_URL || 'http://localhost:4000/api';
    this.apiKey = process.env.SYNAPSO_API_KEY || '';
  }

  /**
   * Set authentication token for requests
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Get default headers for requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make a request to the Synapso API
   */
  private async request<T>(
    endpoint: string, 
    method: string = 'GET', 
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    };

    try {
      // First check if we're online before making the request
      if (!navigator.onLine) {
        throw new Error("OFFLINE: Network connection unavailable");
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle different error types with better messages
        let errorMessage: string;
        
        if (response.status === 404) {
          errorMessage = `Resource not found: ${endpoint}`;
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = "Authentication or permission error";
        } else if (response.status >= 500) {
          errorMessage = "Synapso service is currently unavailable";
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = `Synapso API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`;
        }
        
        console.warn(`Synapso API Error (${response.status}):`, errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result as T;
    } catch (error) {
      // Better error classification
      console.error('Synapso API request failed:', error);
      
      // Classify error for the front-end
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error("TIMEOUT: Synapso service request timed out");
      }
      
      if (errorMessage.includes('OFFLINE')) {
        throw new Error("OFFLINE: Network connection unavailable");
      }
      
      // If fetch is failing entirely, the service is likely down
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        throw new Error("SERVICE_DOWN: Synapso service is unavailable");
      }
      
      throw error;
    }
  }

  // Workflow Methods

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<WorkflowState[]> {
    return this.request<WorkflowState[]>('/workflows');
  }

  /**
   * Get a specific workflow by ID
   */
  async getWorkflow(id: string): Promise<WorkflowState> {
    return this.request<WorkflowState>(`/workflows/${id}`);
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: Partial<WorkflowState>): Promise<WorkflowState> {
    return this.request<WorkflowState>('/workflows', 'POST', workflow);
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(id: string, workflow: Partial<WorkflowState>): Promise<WorkflowState> {
    return this.request<WorkflowState>(`/workflows/${id}`, 'PUT', workflow);
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    return this.request<void>(`/workflows/${id}`, 'DELETE');
  }

  // Node Methods

  /**
   * Get all nodes for a workflow
   */
  async getNodes(workflowId: string): Promise<WorkflowNode[]> {
    return this.request<WorkflowNode[]>(`/workflows/${workflowId}/nodes`);
  }

  /**
   * Get a specific node by ID
   */
  async getNode(workflowId: string, nodeId: string): Promise<WorkflowNode> {
    return this.request<WorkflowNode>(`/workflows/${workflowId}/nodes/${nodeId}`);
  }

  /**
   * Create a new node in a workflow
   */
  async createNode(workflowId: string, node: Partial<WorkflowNode>): Promise<WorkflowNode> {
    return this.request<WorkflowNode>(`/workflows/${workflowId}/nodes`, 'POST', node);
  }

  /**
   * Update a node
   */
  async updateNode(workflowId: string, nodeId: string, node: Partial<WorkflowNode>): Promise<WorkflowNode> {
    return this.request<WorkflowNode>(`/workflows/${workflowId}/nodes/${nodeId}`, 'PUT', node);
  }

  /**
   * Delete a node
   */
  async deleteNode(workflowId: string, nodeId: string): Promise<void> {
    return this.request<void>(`/workflows/${workflowId}/nodes/${nodeId}`, 'DELETE');
  }

  // Edge Methods

  /**
   * Get all edges for a workflow
   */
  async getEdges(workflowId: string): Promise<Edge[]> {
    return this.request<Edge[]>(`/workflows/${workflowId}/edges`);
  }

  /**
   * Create a new edge in a workflow
   */
  async createEdge(workflowId: string, edge: Partial<Edge>): Promise<Edge> {
    return this.request<Edge>(`/workflows/${workflowId}/edges`, 'POST', edge);
  }

  /**
   * Update an edge
   */
  async updateEdge(workflowId: string, edgeId: string, edge: Partial<Edge>): Promise<Edge> {
    return this.request<Edge>(`/workflows/${workflowId}/edges/${edgeId}`, 'PUT', edge);
  }

  /**
   * Delete an edge
   */
  async deleteEdge(workflowId: string, edgeId: string): Promise<void> {
    return this.request<void>(`/workflows/${workflowId}/edges/${edgeId}`, 'DELETE');
  }

  // Canvas Methods

  /**
   * Get canvas data for a workflow
   */
  async getCanvas(workflowId: string): Promise<Canvas> {
    return this.request<Canvas>(`/workflows/${workflowId}/canvas`);
  }

  /**
   * Update canvas data
   */
  async updateCanvas(workflowId: string, canvas: Partial<Canvas>): Promise<Canvas> {
    return this.request<Canvas>(`/workflows/${workflowId}/canvas`, 'PUT', canvas);
  }

  // Agent Methods

  /**
   * Get all agents
   */
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/agents');
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`);
  }

  /**
   * Create a new agent
   */
  async createAgent(agent: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>('/agents', 'POST', agent);
  }

  /**
   * Update an agent
   */
  async updateAgent(id: string, agent: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`, 'PUT', agent);
  }

  /**
   * Delete an agent
   */
  async deleteAgent(id: string): Promise<void> {
    return this.request<void>(`/agents/${id}`, 'DELETE');
  }

  /**
   * Ping the Synapso API to check service availability
   * This is a lightweight method used to verify if the service is accessible
   */
  async ping(): Promise<{ status: string }> {
    try {
      return this.request<{ status: string }>('/ping');
    } catch (error) {
      console.error('Synapso ping failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const synapsoClient = new SynapsoClient(); 