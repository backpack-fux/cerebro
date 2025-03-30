/**
 * React hook for interacting with the Synapso API
 */

import { useCallback, useEffect, useState } from 'react';
import { synapsoClient } from '@/services/api/synapso/synapso.client';
import { synapsoEvents, EventHandler } from '@/services/api/synapso/events.service';
import { 
  WorkflowState, 
  WorkflowNode, 
  Edge, 
  Canvas, 
  Agent,
  RealTimeEvent,
  WorkflowStatus 
} from '@/types/synapso';

export interface UseSynapsoOptions {
  workflowId?: string;
  enableRealtime?: boolean;
  eventTypes?: string[];
  useOfflineFallback?: boolean;
}

// Default workflow for offline mode
const DEFAULT_WORKFLOW: WorkflowState = {
  id: 'offline-workflow',
  name: 'Offline Workflow',
  description: 'Working in offline mode - changes will not be saved',
  status: WorkflowStatus.DRAFT,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Default node for offline mode
const DEFAULT_NODE: WorkflowNode = {
  id: 'offline-node',
  type: 'synapsoTeam',
  workflowId: 'offline-workflow',
  position: { x: 250, y: 150 },
  data: {
    title: 'Offline Node',
    description: 'Working in offline mode',
    workflowId: 'offline-workflow',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function useSynapso(options: UseSynapsoOptions = {}) {
  const { workflowId, enableRealtime = true, eventTypes = [], useOfflineFallback = true } = options;
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [workflows, setWorkflows] = useState<WorkflowState[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowState | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  
  // Network status detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Reconnect and refresh data
      if (workflowId) {
        fetchWorkflow(workflowId).catch(console.error);
        fetchNodes(workflowId).catch(console.error);
        fetchEdges(workflowId).catch(console.error);
      }
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      if (useOfflineFallback && workflowId) {
        // Set offline fallback data
        setCurrentWorkflow({...DEFAULT_WORKFLOW, id: workflowId});
        setNodes([{...DEFAULT_NODE, workflowId}]);
        setEdges([]);
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [workflowId, useOfflineFallback]);
  
  // Fetch workflows
  const fetchWorkflows = useCallback(async () => {
    if (isOffline && useOfflineFallback) {
      setWorkflows([DEFAULT_WORKFLOW]);
      return [DEFAULT_WORKFLOW];
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.getWorkflows();
      setWorkflows(result);
      setConnectionAttempts(0);
      return result;
    } catch (err) {
      const newAttempts = connectionAttempts + 1;
      setConnectionAttempts(newAttempts);
      
      // If multiple connection failures, switch to offline mode
      if (newAttempts >= 2 && useOfflineFallback) {
        console.warn('Connection to Synapso failed, switching to offline mode');
        setIsOffline(true);
        setWorkflows([DEFAULT_WORKFLOW]);
        return [DEFAULT_WORKFLOW];
      }
      
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    } finally {
      setLoading(false);
    }
  }, [isOffline, useOfflineFallback, connectionAttempts]);
  
  // Fetch a specific workflow
  const fetchWorkflow = useCallback(async (id: string) => {
    if (isOffline && useOfflineFallback) {
      const offlineWorkflow = {...DEFAULT_WORKFLOW, id};
      setCurrentWorkflow(offlineWorkflow);
      return offlineWorkflow;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.getWorkflow(id);
      setCurrentWorkflow(result);
      setConnectionAttempts(0);
      return result;
    } catch (err) {
      const newAttempts = connectionAttempts + 1;
      setConnectionAttempts(newAttempts);
      
      // If multiple connection failures, switch to offline mode
      if (newAttempts >= 2 && useOfflineFallback) {
        console.warn(`Connection to Synapso failed for workflow ${id}, using offline mode`);
        setIsOffline(true);
        const offlineWorkflow = {...DEFAULT_WORKFLOW, id};
        setCurrentWorkflow(offlineWorkflow);
        return offlineWorkflow;
      }
      
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [isOffline, useOfflineFallback, connectionAttempts]);
  
  // Fetch nodes for the current workflow
  const fetchNodes = useCallback(async (id: string = workflowId!) => {
    if (!id) {
      throw new Error('Workflow ID is required to fetch nodes');
    }
    
    if (isOffline && useOfflineFallback) {
      const offlineNodes = [{...DEFAULT_NODE, workflowId: id}];
      setNodes(offlineNodes);
      return offlineNodes;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.getNodes(id);
      setNodes(result);
      setConnectionAttempts(0);
      return result;
    } catch (err) {
      const newAttempts = connectionAttempts + 1;
      setConnectionAttempts(newAttempts);
      
      // If multiple connection failures, switch to offline mode
      if (newAttempts >= 2 && useOfflineFallback) {
        console.warn(`Connection to Synapso failed for nodes in workflow ${id}, using offline mode`);
        setIsOffline(true);
        const offlineNodes = [{...DEFAULT_NODE, workflowId: id}];
        setNodes(offlineNodes);
        return offlineNodes;
      }
      
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    } finally {
      setLoading(false);
    }
  }, [workflowId, isOffline, useOfflineFallback, connectionAttempts]);
  
  // Fetch edges for the current workflow
  const fetchEdges = useCallback(async (id: string = workflowId!) => {
    if (!id) {
      throw new Error('Workflow ID is required to fetch edges');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.getEdges(id);
      setEdges(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Fetch canvas for the current workflow
  const fetchCanvas = useCallback(async (id: string = workflowId!) => {
    if (!id) {
      throw new Error('Workflow ID is required to fetch canvas');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.getCanvas(id);
      setCanvas(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Create a new workflow
  const createWorkflow = useCallback(async (workflow: Partial<WorkflowState>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.createWorkflow(workflow);
      setWorkflows(prev => [...prev, result]);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Update a workflow
  const updateWorkflow = useCallback(async (id: string, workflow: Partial<WorkflowState>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.updateWorkflow(id, workflow);
      
      // Update current workflow if it's the one being updated
      if (currentWorkflow?.id === id) {
        setCurrentWorkflow(result);
      }
      
      // Update workflows list
      setWorkflows(prev => 
        prev.map(w => w.id === id ? result : w)
      );
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentWorkflow]);
  
  // Delete a workflow
  const deleteWorkflow = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await synapsoClient.deleteWorkflow(id);
      
      // Update workflows list
      setWorkflows(prev => prev.filter(w => w.id !== id));
      
      // Clear current workflow if it's the one being deleted
      if (currentWorkflow?.id === id) {
        setCurrentWorkflow(null);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentWorkflow]);
  
  // Create a node
  const createNode = useCallback(async (node: Partial<WorkflowNode>, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to create a node');
    }
    
    if (isOffline) {
      if (!useOfflineFallback) return null;
      
      // Create a fake node in offline mode
      const newNode: WorkflowNode = {
        id: `offline-${Date.now()}`,
        workflowId: wfId,
        type: node.type || 'synapsoTeam',
        position: node.position || { x: 100, y: 100 },
        data: node.data || { title: 'Offline Node', workflowId: wfId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setNodes(prev => [...prev, newNode]);
      return newNode;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.createNode(wfId, node);
      setNodes(prev => [...prev, result]);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workflowId, isOffline, useOfflineFallback]);
  
  // Update a node
  const updateNode = useCallback(async (nodeId: string, node: Partial<WorkflowNode>, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to update a node');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.updateNode(wfId, nodeId, node);
      
      // Update nodes list
      setNodes(prev => 
        prev.map(n => n.id === nodeId ? result : n)
      );
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Delete a node
  const deleteNode = useCallback(async (nodeId: string, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to delete a node');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await synapsoClient.deleteNode(wfId, nodeId);
      
      // Update nodes list
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Create an edge
  const createEdge = useCallback(async (edge: Partial<Edge>, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to create an edge');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.createEdge(wfId, edge);
      setEdges(prev => [...prev, result]);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Update an edge
  const updateEdge = useCallback(async (edgeId: string, edge: Partial<Edge>, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to update an edge');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.updateEdge(wfId, edgeId, edge);
      
      // Update edges list
      setEdges(prev => 
        prev.map(e => e.id === edgeId ? result : e)
      );
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Delete an edge
  const deleteEdge = useCallback(async (edgeId: string, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to delete an edge');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await synapsoClient.deleteEdge(wfId, edgeId);
      
      // Update edges list
      setEdges(prev => prev.filter(e => e.id !== edgeId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Update canvas
  const updateCanvas = useCallback(async (canvasData: Partial<Canvas>, wfId: string = workflowId!) => {
    if (!wfId) {
      throw new Error('Workflow ID is required to update canvas');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await synapsoClient.updateCanvas(wfId, canvasData);
      setCanvas(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workflowId]);
  
  // Subscribe to events
  const subscribeToEvent = useCallback((eventType: string, handler: EventHandler) => {
    return synapsoEvents.on(eventType, handler);
  }, []);
  
  // Set up real-time event listeners
  useEffect(() => {
    if (!enableRealtime) {
      return;
    }
    
    const handlers: { [key: string]: () => void } = {};
    
    // Subscribe to node updates
    handlers.nodeUpdate = synapsoEvents.on('node.updated', (event: RealTimeEvent<WorkflowNode>) => {
      const updatedNode = event.data;
      if (updatedNode.workflowId === workflowId) {
        setNodes(prev => 
          prev.map(n => n.id === updatedNode.id ? updatedNode : n)
        );
      }
    });
    
    // Subscribe to node creation
    handlers.nodeCreate = synapsoEvents.on('node.created', (event: RealTimeEvent<WorkflowNode>) => {
      const newNode = event.data;
      if (newNode.workflowId === workflowId) {
        setNodes(prev => [...prev, newNode]);
      }
    });
    
    // Subscribe to node deletion
    handlers.nodeDelete = synapsoEvents.on('node.deleted', (event: RealTimeEvent<{id: string, workflowId: string}>) => {
      const { id, workflowId: nodeWorkflowId } = event.data;
      if (nodeWorkflowId === workflowId) {
        setNodes(prev => prev.filter(n => n.id !== id));
      }
    });
    
    // Subscribe to edge updates
    handlers.edgeUpdate = synapsoEvents.on('edge.updated', (event: RealTimeEvent<Edge>) => {
      const updatedEdge = event.data;
      if (updatedEdge.workflowId === workflowId) {
        setEdges(prev => 
          prev.map(e => e.id === updatedEdge.id ? updatedEdge : e)
        );
      }
    });
    
    // Subscribe to edge creation
    handlers.edgeCreate = synapsoEvents.on('edge.created', (event: RealTimeEvent<Edge>) => {
      const newEdge = event.data;
      if (newEdge.workflowId === workflowId) {
        setEdges(prev => [...prev, newEdge]);
      }
    });
    
    // Subscribe to edge deletion
    handlers.edgeDelete = synapsoEvents.on('edge.deleted', (event: RealTimeEvent<{id: string, workflowId: string}>) => {
      const { id, workflowId: edgeWorkflowId } = event.data;
      if (edgeWorkflowId === workflowId) {
        setEdges(prev => prev.filter(e => e.id !== id));
      }
    });
    
    // Subscribe to canvas updates
    handlers.canvasUpdate = synapsoEvents.on('canvas.updated', (event: RealTimeEvent<Canvas>) => {
      const updatedCanvas = event.data;
      if (updatedCanvas.workflowId === workflowId) {
        setCanvas(updatedCanvas);
      }
    });
    
    // Subscribe to workflow updates
    handlers.workflowUpdate = synapsoEvents.on('workflow.updated', (event: RealTimeEvent<WorkflowState>) => {
      const updatedWorkflow = event.data;
      
      // Update current workflow if it's the one being updated
      if (currentWorkflow?.id === updatedWorkflow.id) {
        setCurrentWorkflow(updatedWorkflow);
      }
      
      // Update workflows list
      setWorkflows(prev => 
        prev.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w)
      );
    });
    
    // Subscribe to workflow creation
    handlers.workflowCreate = synapsoEvents.on('workflow.created', (event: RealTimeEvent<WorkflowState>) => {
      const newWorkflow = event.data;
      setWorkflows(prev => [...prev, newWorkflow]);
    });
    
    // Subscribe to workflow deletion
    handlers.workflowDelete = synapsoEvents.on('workflow.deleted', (event: RealTimeEvent<{id: string}>) => {
      const { id } = event.data;
      
      // Update workflows list
      setWorkflows(prev => prev.filter(w => w.id !== id));
      
      // Clear current workflow if it's the one being deleted
      if (currentWorkflow?.id === id) {
        setCurrentWorkflow(null);
      }
    });
    
    // Subscribe to custom event types
    const customHandlers = eventTypes.map(eventType => {
      return synapsoEvents.on(eventType, (event: RealTimeEvent) => {
        // Custom event handling can be implemented here
        console.log(`[useSynapso] Received custom event: ${eventType}`, event);
      });
    });
    
    return () => {
      // Clean up all event handlers
      Object.values(handlers).forEach(unsubscribe => unsubscribe());
      customHandlers.forEach(unsubscribe => unsubscribe());
    };
  }, [enableRealtime, workflowId, eventTypes, currentWorkflow]);
  
  // Load data if workflow ID is provided
  useEffect(() => {
    if (workflowId) {
      // Load workflow, nodes, edges, and canvas
      fetchWorkflow(workflowId);
      fetchNodes(workflowId);
      fetchEdges(workflowId);
      fetchCanvas(workflowId);
    }
  }, [workflowId, fetchWorkflow, fetchNodes, fetchEdges, fetchCanvas]);
  
  return {
    // State
    loading,
    error,
    workflows,
    currentWorkflow,
    nodes,
    edges,
    canvas,
    isOffline,
    
    // Workflow methods
    fetchWorkflows,
    fetchWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    
    // Node methods
    fetchNodes,
    createNode,
    updateNode,
    deleteNode,
    
    // Edge methods
    fetchEdges,
    createEdge,
    updateEdge,
    deleteEdge,
    
    // Canvas methods
    fetchCanvas,
    updateCanvas,
    
    // Event methods
    subscribeToEvent,
  };
} 