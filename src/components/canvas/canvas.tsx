"use client";

import { 
    ReactFlow, 
    Background, 
    SelectionMode, 
    BackgroundVariant,
    useEdgesState,
    useNodesState,
    Connection,
    addEdge,
    Node,
    useReactFlow,
    Edge,
    XYPosition
} from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { Console } from "@/components/console/console";
import { useCallback, useEffect, useState } from "react";
import { GraphApiClient } from "@/services/graph/neo4j/api-client";
import { NodeType } from "@/services/graph/neo4j/api-urls";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { nodeObserver, NodeUpdateType, NodeUpdateMetadata } from '@/services/graph/observer/node-observer';
import { ReactFlowNodeBase } from '@/services/graph/base-node/reactflow.types';

// Import node type definitions from their respective files
import { RFTeamMemberNodeData } from '@/services/graph/team-member/team-member.types';
import { RFTeamNodeData } from '@/services/graph/team/team.types';
import { RFFeatureNodeData } from '@/services/graph/feature/feature.types';
import { RFOptionNodeData } from '@/services/graph/option/option.types';
import { RFProviderNodeData } from '@/services/graph/provider/provider.types';
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';

// Configure panning buttons (1 = middle mouse, 2 = right mouse)
// Use middle mouse button (1) for panning to avoid conflicts with selection
const panOnDragButtons = [1];

/**
 * Map of node types to their respective data interfaces
 * This allows us to maintain type safety while working with different node types
 */
type NodeDataMap = {
    'teamMember': RFTeamMemberNodeData;
    'team': RFTeamNodeData;
    'feature': RFFeatureNodeData;
    'milestone': RFMilestoneNodeData;
    'provider': RFProviderNodeData;
    'option': RFOptionNodeData;
    'meta': RFMetaNodeData;
    // Fallback for node types without a specific interface yet
    // This ensures we can still work with new node types while maintaining some type safety
    // If you add a new node type, define its interface and add it above instead of relying on this fallback
    [key: string]: ReactFlowNodeBase;
};

/**
 * Type used for node data in the Canvas component
 * Uses a discriminated union based on the node type
 */
type GraphNodeData = NodeDataMap[NodeType];

/**
 * Canvas Component
 * 
 * This component manages the main ReactFlow graph display, handling node creation, updating, deletion,
 * and edge connections between nodes. It uses type definitions from each node type's file to ensure
 * type safety across different node types.
 * 
 * Type Safety Strategy:
 * - Import specific ReactFlow node data types from each service directory
 * - Use a discriminated union based on NodeType to create a type-safe GraphNodeData
 * - Each node operation preserves the specific type information for its node type
 * 
 * @see RFTeamMemberNodeData, RFTeamNodeData, etc. for specific node type definitions
 */
export default function Canvas() {
    // Use GraphNodeData type for nodes
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingNodes, setDeletingNodes] = useState<Set<string>>(new Set());
    const [isCreatingNode, setIsCreatingNode] = useState<Record<string, boolean>>({});
    
    // Get ReactFlow instance for viewport and node operations
    const { getViewport, addNodes } = useReactFlow();
    
    // Add a node to the graph
    /**
     * Adds a new node to the graph
     * @param nodeType The type of node to create
     * @param label Display name for the node
     * @param position Initial position on the canvas
     * @returns The node data from the API
     * 
     * @remarks
     * We use 'any' here because the return type can vary based on the API response.
     * The code properly validates the response with type guards before using it.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addNodeToGraph = useCallback(async (nodeType: NodeType, label: string, position: XYPosition): Promise<any> => {
        // Setup base node data with common fields
        const now = new Date().toISOString();
        
        // Create node data based on node type
        let nodeData: GraphNodeData;
        
        // Customize based on node type
        switch(nodeType) {
            case 'teamMember':
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                    roles: [],
                    hoursPerDay: 8,
                    daysPerWeek: 5,
                    weeklyCapacity: 40,
                } as RFTeamMemberNodeData;
                break;
            
            case 'team':
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                    season: {
                        startDate: '2025-01-01',
                        endDate: '2025-12-31',
                        name: 'New Season'
                    },
                    roster: []
                } as RFTeamNodeData;
                break;
            
            case 'feature':
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                    status: 'planning',
                    teamMembers: [],
                    memberAllocations: [],
                    teamAllocations: []
                } as RFFeatureNodeData;
                break;
            
            case 'milestone':
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                    status: 'planning'
                } as RFMilestoneNodeData;
                break;
            
            case 'provider':
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                } as RFProviderNodeData;
                break;
            
            case 'option':
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                    status: 'planning',
                    goals: [],
                    risks: []
                } as RFOptionNodeData;
                break;
            
            // For all other node types
            default:
                nodeData = {
                    name: label,
                    title: label,
                    createdAt: now,
                    updatedAt: now,
                    position,
                } as GraphNodeData;
                break;
        }
        
        const result = await GraphApiClient.createNode(nodeType, nodeData);
        
        console.log(`Node created successfully:`, result);
        
        // Check if the node was created but is now blacklisted (rare case)
        if (result && result.id && typeof result.id === 'string' && GraphApiClient.isNodeBlacklisted(result.id)) {
            console.warn(`⚠️ Created node ${result.id} is blacklisted, removing from UI`);
            toast.warning(`Node was created but marked problematic`, {
                description: `The node was created but has been marked as problematic and will be removed.`,
                duration: 5000
            });
            return result;
        }
        
        // Add the node to the UI
        const newNode: Node<GraphNodeData> = {
            id: result.id as string,
            type: nodeType,
            position,
            data: {
                ...nodeData,
                ...(result.data && typeof result.data === 'object' ? result.data : {})
            }
        };
        
        addNodes([newNode]);
        
        // Show success toast
        toast(`Node created`, {
            description: `New ${nodeType} node has been created.`,
            duration: 3000
        });
        
        return result;
    }, [addNodes]);
    
    // Function to create a new node from the console
    const createNode = useCallback(async (type: string, label: string): Promise<void> => {
        setIsCreatingNode(prev => ({ ...prev, [type]: true }));

        try {
            // Get current viewport to position the node in the visible area
            const viewport = getViewport();
            const position = {
                x: -viewport.x + window.innerWidth / 2 - 75,
                y: -viewport.y + window.innerHeight / 2 - 75
            };
            
            await addNodeToGraph(type as NodeType, label, position);
        } catch (error) {
            console.error(`Error creating ${type} node:`, error);
            toast.error(`Failed to create ${type} node`, {
                description: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000
            });
        } finally {
            setIsCreatingNode(prev => ({ ...prev, [type]: false }));
        }
    }, [addNodeToGraph, getViewport]);
    
    // Fetch graph data on component mount
    useEffect(() => {
        const fetchGraphData = async () => {
            try {
                setIsLoading(true);
                
                // Only attempt cleanup if there are blacklisted nodes
                if (GraphApiClient.hasBlacklistedNodes()) {
                    await GraphApiClient.cleanupBlacklistedNodes();
                }
                
                const response = await fetch('/api/graph');
                
                if (!response.ok) {
                    // Try to get more detailed error information from the response
                    let errorDetails = '';
                    try {
                        const errorResponse = await response.json();
                        errorDetails = errorResponse.details || errorResponse.error || '';
                    } catch (e) {
                        // If we can't parse the JSON, just use the status text
                        console.warn('Could not parse error response:', e);
                    }
                    
                    const errorMessage = `Failed to fetch graph data: ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`;
                    console.error(errorMessage);
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                console.log('Loaded graph data:', data);
                
                if (data.nodes && Array.isArray(data.nodes)) {
                    // Filter out any blacklisted nodes
                    const filteredNodes = data.nodes.filter((node: Node<GraphNodeData>) => {
                        const isBlacklisted = GraphApiClient.isNodeBlacklisted(node.id);
                        if (isBlacklisted) {
                            console.warn(`🚫 Filtering out blacklisted node ${node.id} from initial load`);
                        }
                        return !isBlacklisted;
                    });
                    
                    console.log(`Filtered out ${data.nodes.length - filteredNodes.length} blacklisted nodes`);
                    setNodes(filteredNodes);
                }
                
                if (data.edges && Array.isArray(data.edges)) {
                    setEdges(data.edges);
                }
            } catch (error) {
                console.error('Error fetching graph data:', error);
                setError(error instanceof Error ? error.message : 'Unknown error');
                
                toast.error('Failed to load graph data', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                    duration: 5000
                });
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchGraphData();
    }, [setNodes, setEdges]);
    
    // Handle node updates from the observer
    useEffect(() => {
        const handleNodeUpdate = async (
            publisherId: string, 
            data: unknown, 
            metadata: NodeUpdateMetadata
        ) => {
            try {
                const nodeId = publisherId;
                const updateType = metadata.updateType;
                
                // Skip updates for blacklisted nodes
                if (GraphApiClient.isNodeBlacklisted(nodeId)) {
                    console.warn(`🚫 Skipping update for blacklisted node ${nodeId}`);
                    return;
                }
                
                // Get the node type from the existing nodes
                const existingNode = nodes.find(node => node.id === nodeId);
                if (!existingNode) {
                    console.warn(`Node ${nodeId} not found in graph for update`);
                    return;
                }
                
                const nodeType = existingNode.type as NodeType;
                
                // Handle different update types
                switch (updateType) {
                    case NodeUpdateType.DELETE:
                        setDeletingNodes(prev => new Set([...prev, nodeId]));
                        try {
                            await GraphApiClient.deleteNode(nodeType, nodeId);
                            setNodes(nodes => nodes.filter(node => node.id !== nodeId));
                            // Also remove any edges connected to this node
                            setEdges(edges => edges.filter(edge => 
                                edge.source !== nodeId && edge.target !== nodeId
                            ));
                        } finally {
                            setDeletingNodes(prev => {
                                const next = new Set(prev);
                                next.delete(nodeId);
                                return next;
                            });
                        }
                        break;
                        
                    case NodeUpdateType.CONTENT:
                    case NodeUpdateType.ATTRIBUTE:
                        try {
                            const updatedNode = await GraphApiClient.getNode(nodeType, nodeId);
                            if (!updatedNode) {
                                console.warn(`Node ${nodeId} not found during update`);
                                return;
                            }
                            
                            // Now we're dealing with an actual GraphNodeData with proper typing
                            setNodes(nodes => nodes.map(node => 
                                node.id === nodeId 
                                    ? { 
                                        ...node, 
                                        data: { 
                                            ...node.data, 
                                            ...(updatedNode.data && typeof updatedNode.data === 'object' ? updatedNode.data : {})
                                        } 
                                    } 
                                    : node
                            ));
                        } catch (error) {
                            console.error(`Error updating node ${nodeId}:`, error);
                            if (error instanceof Error && error.message.includes('404')) {
                                // Node was deleted, remove it from the graph
                                setNodes(nodes => nodes.filter(node => node.id !== nodeId));
                            }
                        }
                        break;
                }
            } catch (error) {
                console.error(`Error handling node update for ${publisherId}:`, error);
                toast.error('Failed to update node', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                    duration: 5000
                });
            }
        };
        
        // Subscribe to node updates with a unique subscriber ID
        const subscriberId = 'canvas';
        nodes.forEach(node => {
            nodeObserver.subscribe(subscriberId, node.id, handleNodeUpdate, NodeUpdateType.ANY);
        });
        
        // Cleanup subscription
        return () => {
            nodes.forEach(node => {
                nodeObserver.unsubscribe(subscriberId, node.id, handleNodeUpdate, NodeUpdateType.ANY);
            });
        };
    }, [nodes, setNodes, setEdges]);
    
    // Handle node deletion
    const handleNodeDelete = useCallback(async (nodeId: string) => {
        const nodeToDelete = nodes.find(node => node.id === nodeId);
        
        if (!nodeToDelete) {
            console.log(`Node ${nodeId} not found in state, skipping deletion`);
            return;
        }
        
        // Mark node as being deleted
        setDeletingNodes(prev => new Set(prev).add(nodeId));
        
        // First identify edges connected to this node so we can handle them appropriately
        const connectedEdges = edges.filter(
            edge => edge.source === nodeId || edge.target === nodeId
        );
        
        if (connectedEdges.length > 0) {
            console.log(`Found ${connectedEdges.length} edges connected to node ${nodeId} that will be affected`);
        }
        
        try {
            console.log(`Deleting ${nodeToDelete.type} node: ${nodeId}`);
            
            // Before deleting from backend, notify subscribers that this node is being deleted
            nodeObserver.publish(nodeId, { id: nodeId }, {
                updateType: NodeUpdateType.DELETE,
                source: 'ui'
            });
            
            // Try to delete the node
            try {
                // Map node types to match API_URLS keys
                let nodeType = nodeToDelete.type;
                if (nodeType === 'team_member' || nodeType === 'teammember') {
                    nodeType = 'teamMember';
                }
                
                // Delete the node from the backend - this should cascade to edges
                await GraphApiClient.deleteNode(nodeType as NodeType, nodeId);
                console.log(`Successfully deleted ${nodeToDelete.type} node: ${nodeId}`);
                
                // After node deletion, remove all connected edges from UI state
                // This prevents react-flow from trying to manage edges that don't have both ends
                if (connectedEdges.length > 0) {
                    setEdges(currentEdges => 
                        currentEdges.filter(edge => 
                            edge.source !== nodeId && edge.target !== nodeId
                        )
                    );
                    console.log(`Removed ${connectedEdges.length} connected edges from UI state`);
                }
                
                // Show success toast
                toast(`Node deleted`, {
                    description: `The ${nodeToDelete.type} node has been removed.`
                });
            } catch (error) {
                // If the error is a 404, the node doesn't exist in the database
                // We can still remove it from the UI
                if (error instanceof Error && error.message.includes('404')) {
                    console.warn(`Node ${nodeId} not found in database, removing from UI only`);
                    
                    // Still remove connected edges from UI
                    if (connectedEdges.length > 0) {
                        setEdges(currentEdges => 
                            currentEdges.filter(edge => 
                                edge.source !== nodeId && edge.target !== nodeId
                            )
                        );
                        console.log(`Removed ${connectedEdges.length} connected edges from UI state (node was already deleted)`);
                    }
                    
                    toast(`Node removed from canvas`, {
                        description: `The node was already deleted from the database.`
                    });
                } else {
                    // For other errors, add the node back to the UI
                    console.error(`Error deleting node ${nodeId}:`, error);
                    setNodes((currentNodes: Node<GraphNodeData>[]) => [...currentNodes, nodeToDelete]);
                    setError(`Failed to delete node: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    
                    // Show error toast
                    toast.error(`Failed to delete node`, {
                        description: `${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                }
            }
            
            // Clean up all subscriptions for this node
            nodeObserver.unsubscribeAll(nodeId);
        } catch (error) {
            console.error(`Error in node deletion process for ${nodeId}:`, error);
            
            // If deletion fails, add the node back
            setNodes((currentNodes: Node<GraphNodeData>[]) => [...currentNodes, nodeToDelete]);
            
            // Show error message
            setError(`Failed to delete node: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            // Show error toast
            toast.error(`Failed to delete node`, {
                description: `${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            // Remove from deleting set
            setDeletingNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(nodeId);
                return newSet;
            });
        }
    }, [nodes, setNodes, edges, setEdges, setError]);
    
    // Handle edge deletion
    const handleEdgeDelete = useCallback(async (edgeId: string) => {
        const edgeToDelete = edges.find((edge: Edge) => edge.id === edgeId);
        
        if (!edgeToDelete) {
            console.log(`Edge ${edgeId} not found in state, skipping deletion`);
            return;
        }
        
        // Mark edge as being deleted
        setDeletingNodes(prev => new Set(prev).add(edgeToDelete.source));
        
        try {
            console.log(`Deleting edge: ${edgeId}`);
            
            // Determine the source node type to know which handler to use
            const sourceNode = nodes.find(node => node.id === edgeToDelete.source);
            if (!sourceNode) {
                console.warn(`Source node ${edgeToDelete.source} not found for edge ${edgeId}, the node may have been deleted already. Removing edge from UI only.`);
                // In this case, we don't need to do anything with the backend since the node deletion
                // should have already cascaded to delete its edges
                return;
            }

            // Try to delete the edge in the backend
            const success = await GraphApiClient.deleteEdge(sourceNode.type as NodeType, edgeId);
            if (success) {
                console.log(`Successfully deleted ${sourceNode.type} edge: ${edgeId}`);
                
                // Show success toast only for user-initiated deletions (not cascading)
                if (!deletingNodes.has(edgeToDelete.source) && !deletingNodes.has(edgeToDelete.target)) {
                    toast(`Connection removed`, {
                        description: `The connection has been deleted.`
                    });
                }
            }
        } catch (error) {
            console.error(`Error deleting edge ${edgeId}:`, error);
            
            // Only add the edge back if both nodes still exist - otherwise it'll cause React Flow errors
            const sourceExists = nodes.some(node => node.id === edgeToDelete.source);
            const targetExists = nodes.some(node => node.id === edgeToDelete.target);
            
            if (sourceExists && targetExists) {
                // If deletion fails and both nodes still exist, add the edge back to UI
                setEdges((currentEdges: Edge[]) => [...currentEdges, edgeToDelete]);
                
                // Show error message for non-404 errors
                if (!String(error).includes('404')) {
                    setError(`Failed to delete edge: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    
                    // Show error toast
                    toast.error(`Failed to delete connection`, {
                        description: `${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                }
            } else {
                console.log(`Not restoring edge ${edgeId} because one or both nodes have been deleted`);
            }
        } finally {
            // Remove from deleting set
            setDeletingNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(edgeToDelete.source);
                return newSet;
            });
        }
    }, [edges, setEdges, nodes, deletingNodes, setError]);
    
    // Handle new connections between nodes
    const onConnect = useCallback(async (connection: Connection) => {
        // Check if either node is blacklisted
        if (GraphApiClient.isNodeBlacklisted(connection.source!) || 
            GraphApiClient.isNodeBlacklisted(connection.target!)) {
            console.warn(`⚠️ Attempted to connect to a blacklisted node, connection rejected`);
            
            toast.warning(`Connection rejected`, {
                description: `One of the nodes in this connection has been marked as problematic.`,
                duration: 5000
            });
            return;
        }
        
        // First update the UI optimistically
        setEdges((eds) => addEdge(connection, eds));
        
        try {
            // Get source and target node details
            const sourceNode = nodes.find(node => node.id === connection.source);
            const targetNode = nodes.find(node => node.id === connection.target);
            
            if (!sourceNode || !targetNode) {
                throw new Error('Source or target node not found');
            }
            
            console.log(`Creating edge from ${sourceNode.type} (${connection.source}) to ${targetNode.type} (${connection.target})`);
            
            // Determine which node type to use for the API call (usually the source node)
            let nodeType = sourceNode.type as string;
            if (nodeType === 'team_member' || nodeType === 'teammember') {
                nodeType = 'teamMember';
            }
            
            // Determine edge type based on the connected nodes
            let edgeType = 'default';
            
            // Set specific edge type based on source and target node types
            if (sourceNode.type === 'teamMember' && targetNode.type === 'team') {
                edgeType = 'team';
            } else if (sourceNode.type === 'team' && targetNode.type === 'teamMember') {
                edgeType = 'team';
            } else if (sourceNode.type === 'teamMember' && targetNode.type === 'teamMember') {
                edgeType = 'collaboration';
            } else if (sourceNode.type === 'teamMember' && targetNode.type === 'feature') {
                edgeType = 'feature';
            } else if (sourceNode.type === 'feature' && targetNode.type === 'teamMember') {
                edgeType = 'feature';
            }
            
            // Get current timestamp
            const now = new Date().toISOString();
            
            // Create the edge in the backend
            const edgeData: {
                source: string;
                target: string;
                type: string;
                sourceHandle?: string;
                targetHandle?: string;
                data: {
                    createdAt: string;
                    updatedAt: string;
                    allocation?: number;
                    role?: string;
                };
            } = {
                source: connection.source!, // Required field
                target: connection.target!, // Required field
                type: edgeType, // Required field
                sourceHandle: connection.sourceHandle || undefined,
                targetHandle: connection.targetHandle || undefined,
                data: {
                    createdAt: now,
                    updatedAt: now
                }
            };
            
            // Add special properties for team-member to team connections
            if (edgeType === 'team') {
                // For team connections, add allocation and role
                edgeData.data.allocation = 100; // Default to 100% allocation
                edgeData.data.role = 'Developer'; // Default role
            }
            
            const result = await GraphApiClient.createEdge(nodeType as NodeType, edgeData);
            console.log('Edge created successfully:', result);
            
            // Update the edge in the UI with the returned ID and any other properties
            setEdges(eds => 
                eds.map(e => {
                    // Find the temporary edge we just added and update it with the real ID
                    if (e.source === connection.source && 
                        e.target === connection.target && 
                        e.sourceHandle === connection.sourceHandle && 
                        e.targetHandle === connection.targetHandle) {
                        return {
                            ...e,
                            id: result.id as string,
                            data: {
                                ...e.data,
                                ...(result.data && typeof result.data === 'object' ? result.data : {})
                            }
                        };
                    }
                    return e;
                })
            );
            
            toast(`Connection created`, {
                description: `Successfully connected the nodes.`,
                duration: 3000
            });
        } catch (error) {
            console.error('Failed to create edge:', error);
            
            // Remove the edge from the UI since the backend creation failed
            setEdges(eds => 
                eds.filter(e => 
                    !(e.source === connection.source && 
                      e.target === connection.target && 
                      e.sourceHandle === connection.sourceHandle && 
                      e.targetHandle === connection.targetHandle)
                )
            );
            
            setError(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            toast.error(`Connection failed`, {
                description: `${error instanceof Error ? error.message : 'Unknown error'}`,
                duration: 5000
            });
        }
    }, [nodes, setEdges, setError]);
    
    // Handle node drag stop - update position in database
    const onNodeDragStop = useCallback(async (event: React.MouseEvent, node: Node<GraphNodeData>) => {
        // Skip if node is being deleted
        if (deletingNodes.has(node.id)) return;
        
        try {
            // Get node type
            const nodeType = node.type as NodeType;
            
            // Update position in database
            await GraphApiClient.updateNode(nodeType, node.id, { position: node.position });
            
            // Dispatch a custom event for node drag stop
            const customEvent = new CustomEvent('nodeDragStop', {
                detail: { nodeId: node.id, nodeType: node.type }
            });
            window.dispatchEvent(customEvent);
            
            // Publish position update to observer system
            nodeObserver.publish(node.id, { position: node.position }, {
                updateType: NodeUpdateType.POSITION,
                source: 'drag'
            });
        } catch (error) {
            console.error(`Failed to update position for node ${node.id}:`, error);
            toast.error(`Failed to update node position: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [deletingNodes]);
    
    // Handle selection events
    const onSelectionStart = useCallback(() => {
        console.log('Selection started');
    }, []);
    
    const onSelectionEnd = useCallback(() => {
        console.log('Selection ended');
    }, []);
    
    const onSelectionChange = useCallback(({ nodes, edges }: { 
        nodes: Node<GraphNodeData>[]; 
        edges: Edge[] 
    }) => {
        console.log('Selection changed:', { selectedNodes: nodes.length, selectedEdges: edges.length });
    }, []);
    
    // Return the ReactFlow component with all necessary props
    return (
        <div className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                panOnScroll
                selectionMode={SelectionMode.Partial}
                selectionOnDrag={true}
                selectionKeyCode="Shift"
                multiSelectionKeyCode="Control"
                panOnDrag={panOnDragButtons}
                deleteKeyCode={['Backspace', 'Delete']}
                onNodesDelete={(nodes: Node<GraphNodeData>[]) => nodes.forEach(node => handleNodeDelete(node.id))}
                onEdgesDelete={(edges) => edges.forEach(edge => handleEdgeDelete(edge.id))}
                onSelectionStart={onSelectionStart}
                onSelectionEnd={onSelectionEnd}
                onSelectionChange={onSelectionChange}
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
            
            {/* Error display */}
            {error && (
                <div className="absolute bottom-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            
            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                </div>
            )}
            
            {/* Toast notifications */}
            <Toaster position="top-right" />
            
            {/* Debug console */}
            <Console 
                createNode={createNode} 
                isCreatingNode={isCreatingNode} 
            />
        </div>
    );
}