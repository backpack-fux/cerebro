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
    NodeChange,
    NodePositionChange,
    useReactFlow,
} from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { Console } from "@/components/console/console";
import { useCallback, useEffect, useState } from "react";
import { GraphApiClient } from "@/services/graph/neo4j/api-client";
import { NodeType } from "@/services/graph/neo4j/api-urls";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { nodeObserver, NodeUpdateType } from '@/services/graph/observer/node-observer';

// Configure panning buttons (1 = middle mouse, 2 = right mouse)
// Use middle mouse button (1) for panning to avoid conflicts with selection
const panOnDragButtons = [1];

export default function Canvas() {
    // Use any type to avoid TypeScript errors with complex node structures
    const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingNodes, setDeletingNodes] = useState<Set<string>>(new Set());
    const [deletingEdges, setDeletingEdges] = useState<Set<string>>(new Set());
    const [updatingNodePositions, setUpdatingNodePositions] = useState<Set<string>>(new Set());
    const [isCreatingNode, setIsCreatingNode] = useState<Record<string, boolean>>({});
    
    // Get ReactFlow instance for viewport and node operations
    const { getViewport, addNodes } = useReactFlow();
    
    // Function to create a new node from the console
    const createNode = useCallback(async (type: string, label: string) => {
        try {
            // Mark this node type as being created
            setIsCreatingNode(prev => ({ ...prev, [type]: true }));
            
            // Get current viewport to position the node in the visible area
            const viewport = getViewport();
            const position = {
                x: -viewport.x + window.innerWidth / 2 - 75,
                y: -viewport.y + window.innerHeight / 2 - 75
            };
            
            console.log(`Creating new ${type} node with label "${label}" at position:`, position);
            
            // Create the node in the backend
            const nodeType = type as NodeType;
            
            // Get current timestamp for created/updated fields
            const now = new Date().toISOString();
            
            // Handle different node types with their specific required fields
            let nodeData: any = {
                position
            };
            
            // Different node types require different fields
            switch (type) {
                case 'teamMember':
                    nodeData = {
                        position,
                        title: label,
                        roles: ['developer'], // Default role
                        hoursPerDay: 8, // Default values
                        daysPerWeek: 5,
                        weeklyCapacity: 40,
                        name: label, // Name is required by ReactFlowNodeBase
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
                
                case 'team':
                    nodeData = {
                        position,
                        title: label,
                        roster: [], // Empty roster to start
                        name: label, // Name is required by ReactFlowNodeBase
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
                
                case 'feature':
                    nodeData = {
                        position,
                        title: label,
                        buildType: 'internal', // Default values
                        timeUnit: 'days',
                        duration: 5,
                        status: 'planning',
                        name: label, // Name is required by ReactFlowNodeBase
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
                
                case 'milestone':
                    nodeData = {
                        position,
                        title: label,
                        name: label, // Name is required by ReactFlowNodeBase
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default due date: 30 days from now
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
                
                case 'provider':
                    nodeData = {
                        position,
                        title: label,
                        name: label, // Name is required by ReactFlowNodeBase
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
                
                case 'option':
                    nodeData = {
                        position,
                        title: label,
                        name: label, // Name is required by ReactFlowNodeBase
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
                
                // For all other node types
                default:
                    nodeData = {
                        position,
                        title: label, // Use title to be safe
                        label, // Also include label
                        name: label, // Name is required by ReactFlowNodeBase
                        createdAt: now,
                        updatedAt: now
                    };
                    break;
            }
            
            const result = await GraphApiClient.createNode(nodeType, nodeData);
            
            console.log(`Node created successfully:`, result);
            
            // Check if the node was created but is now blacklisted (rare case)
            if (result && result.id && GraphApiClient.isNodeBlacklisted(result.id)) {
                console.warn(`⚠️ Created node ${result.id} is blacklisted, removing from UI`);
                toast.warning(`Node was created but marked problematic`, {
                    description: `The node was created but has been marked as problematic and will be removed.`,
                    duration: 5000
                });
                return result;
            }
            
            // Add the node to the UI
            const newNode = {
                id: result.id,
                type,
                position,
                data: {
                    label,
                    ...result.data
                }
            };
            
            addNodes([newNode]);
            
            // Show success toast
            toast(`Node created`, {
                description: `New ${type} node has been created.`,
                duration: 3000
            });
            
            return result;
        } catch (error) {
            console.error(`Failed to create ${type} node:`, error);
            setError(`Failed to create node: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            // Show error toast
            toast.error(`Failed to create node`, {
                description: `${error instanceof Error ? error.message : 'Unknown error'}`,
                duration: 5000
            });
            
            throw error;
        } finally {
            // Mark this node type as no longer being created
            setIsCreatingNode(prev => ({ ...prev, [type]: false }));
        }
    }, [getViewport, addNodes, setError]);
    
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
                    const filteredNodes = data.nodes.filter((node: any) => {
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
                    // Filter out edges connected to blacklisted nodes
                    const filteredEdges = data.edges.filter((edge: any) => {
                        const sourceId = edge.from || edge.source;
                        const targetId = edge.to || edge.target;
                        
                        const isConnectedToBlacklisted = 
                            GraphApiClient.isNodeBlacklisted(sourceId) || 
                            GraphApiClient.isNodeBlacklisted(targetId);
                            
                        if (isConnectedToBlacklisted) {
                            console.warn(`🚫 Filtering out edge connected to blacklisted node: ${edge.id}`);
                        }
                        
                        return !isConnectedToBlacklisted;
                    });
                
                    // Transform edges if needed to match ReactFlow's expected format
                    const formattedEdges = filteredEdges.map((edge: any) => ({
                        id: edge.id,
                        source: edge.from || edge.source,
                        target: edge.to || edge.target,
                        type: 'default',
                        data: {
                            label: edge.properties?.label || edge.data?.label,
                            edgeType: edge.type?.toLowerCase() || edge.data?.edgeType
                        }
                    }));
                    
                    console.log('Formatted edges:', formattedEdges);
                    setEdges(formattedEdges);
                }
                
                setError(null);
            } catch (err) {
                console.error('Error loading graph data:', err);
                setError(err instanceof Error ? err.message : 'Unknown error loading graph data');
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchGraphData();
    }, [setNodes, setEdges]);
    
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
                    setNodes((currentNodes: any[]) => [...currentNodes, nodeToDelete]);
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
            setNodes((currentNodes: any[]) => [...currentNodes, nodeToDelete]);
            
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
        const edgeToDelete = edges.find((edge: any) => edge.id === edgeId);
        
        if (!edgeToDelete) {
            console.log(`Edge ${edgeId} not found in state, skipping deletion`);
            return;
        }
        
        // Mark edge as being deleted
        setDeletingEdges(prev => new Set(prev).add(edgeId));
        
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
                setEdges((currentEdges: any[]) => [...currentEdges, edgeToDelete]);
                
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
            setDeletingEdges(prev => {
                const newSet = new Set(prev);
                newSet.delete(edgeId);
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
            const edgeData: any = {
                source: connection.source, // Required field
                target: connection.target, // Required field
                type: edgeType, // Required field
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
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
                            id: result.id,
                            data: {
                                ...e.data,
                                ...result.data
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
    
    // Handle node position updates with better UX
    const handleNodePositionChange = useCallback(async (change: NodePositionChange) => {
        const { id, position } = change;
        
        // Skip if we're already updating this node's position or if position is undefined
        if (updatingNodePositions.has(id) || !position) return;
        
        // Get the current node
        const currentNode = nodes.find(node => node.id === id);
        if (!currentNode) return;
        
        // Mark node as being updated
        setUpdatingNodePositions(prev => new Set(prev).add(id));
        
        // Store the node's position to check if it changed after the debounce
        const initialPosition = { 
            x: position.x || 0,
            y: position.y || 0
        };
        
        // Use a longer debounce for position updates to avoid excessive API calls during dragging
        setTimeout(async () => {
            try {
                // Get the current node to see if position has changed significantly
                const currentNode = nodes.find(node => node.id === id);
                if (!currentNode || !currentNode.position) return;
                
                // Only update if position has changed by more than 5 pixels in any direction
                // This prevents API calls for tiny movements
                const significantChange = 
                    Math.abs((currentNode.position.x || 0) - initialPosition.x) > 5 ||
                    Math.abs((currentNode.position.y || 0) - initialPosition.y) > 5;
                
                if (significantChange) {
                    await GraphApiClient.updateNode(
                        currentNode.type as NodeType,
                        id,
                        { position: currentNode.position }
                    );
                    console.log(`Updated position for ${currentNode.type} node ${id}:`, currentNode.position);
                } else {
                    console.log(`Skipping position update for node ${id} (change too small)`);
                }
            } catch (error) {
                console.error(`Failed to update position for node ${id}:`, error);
            } finally {
                // Remove from updating set
                setUpdatingNodePositions(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(id);
                    return newSet;
                });
            }
        }, 1000); // 1 second debounce
    }, [updatingNodePositions, nodes]);
    
    // Handle node drag stop - update position in database
    const onNodeDragStop = useCallback(async (event: React.MouseEvent, node: Node) => {
        // Skip if node is being deleted
        if (deletingNodes.has(node.id)) return;
        
        // Add to updating set
        setUpdatingNodePositions(prev => new Set(prev).add(node.id));
        
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
        } finally {
            // Remove from updating set
            setUpdatingNodePositions(prev => {
                const newSet = new Set(prev);
                newSet.delete(node.id);
                return newSet;
            });
        }
    }, [deletingNodes]);
    
    // Handle selection events
    const onSelectionStart = useCallback(() => {
        console.log('Selection started');
    }, []);
    
    const onSelectionEnd = useCallback(() => {
        console.log('Selection ended');
    }, []);
    
    const onSelectionChange = useCallback(({ nodes, edges }: { nodes: Node[]; edges: any[] }) => {
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
                onNodesDelete={(nodes) => nodes.forEach(node => handleNodeDelete(node.id))}
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