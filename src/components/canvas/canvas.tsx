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
} from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { Console } from "@/components/console/console";
import { useCallback, useEffect, useState } from "react";
import { GraphApiClient } from "@/services/graph/neo4j/api-client";
import { NodeType } from "@/services/graph/neo4j/api-urls";

// Configure panning buttons (1 = middle mouse, 2 = right mouse)
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
    
    // Fetch graph data on component mount
    useEffect(() => {
        const fetchGraphData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/graph');
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch graph data: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('Loaded graph data:', data);
                
                if (data.nodes && Array.isArray(data.nodes)) {
                    setNodes(data.nodes);
                }
                
                if (data.edges && Array.isArray(data.edges)) {
                    // Transform edges if needed to match ReactFlow's expected format
                    const formattedEdges = data.edges.map((edge: any) => ({
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
        const nodeToDelete = nodes.find((node: any) => node.id === nodeId);
        
        if (!nodeToDelete) {
            console.warn(`Node with ID ${nodeId} not found for deletion`);
            return;
        }
        
        // Mark node as being deleted
        setDeletingNodes(prev => new Set(prev).add(nodeId));
        
        try {
            console.log(`Deleting ${nodeToDelete.type} node: ${nodeId}`);
            
            // Try to delete the node
            try {
                await GraphApiClient.deleteNode(nodeToDelete.type as NodeType, nodeId);
                console.log(`Successfully deleted ${nodeToDelete.type} node: ${nodeId}`);
            } catch (error) {
                // If the error is a 404, the node doesn't exist in the database
                // We can still remove it from the UI
                if (error instanceof Error && error.message.includes('404')) {
                    console.warn(`Node ${nodeId} not found in database, removing from UI only`);
                } else {
                    // For other errors, add the node back to the UI
                    console.error(`Error deleting node ${nodeId}:`, error);
                    setNodes((currentNodes: any[]) => [...currentNodes, nodeToDelete]);
                    setError(`Failed to delete node: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.error(`Error in node deletion process for ${nodeId}:`, error);
            
            // If deletion fails, add the node back
            setNodes((currentNodes: any[]) => [...currentNodes, nodeToDelete]);
            
            // Show error message
            setError(`Failed to delete node: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            // Remove from deleting set
            setDeletingNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(nodeId);
                return newSet;
            });
        }
    }, [nodes, setNodes]);
    
    // Handle edge deletion
    const handleEdgeDelete = useCallback(async (edgeId: string) => {
        const edgeToDelete = edges.find((edge: any) => edge.id === edgeId);
        
        if (!edgeToDelete) return;
        
        // Mark edge as being deleted
        setDeletingEdges(prev => new Set(prev).add(edgeId));
        
        try {
            console.log(`Deleting edge: ${edgeId}`);
            
            // Determine the source node type to know which handler to use
            const sourceNode = nodes.find(node => node.id === edgeToDelete.source);
            if (!sourceNode) {
                console.warn(`Source node not found for edge ${edgeId}, removing from UI only`);
                return;
            }
            
            await GraphApiClient.deleteEdge(sourceNode.type as NodeType, edgeId);
            console.log(`Successfully deleted ${sourceNode.type} edge: ${edgeId}`);
        } catch (error) {
            console.error(`Error deleting edge ${edgeId}:`, error);
            
            // If deletion fails, add the edge back
            setEdges((currentEdges: any[]) => [...currentEdges, edgeToDelete]);
            
            // Show error message
            setError(`Failed to delete edge: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            // Remove from deleting set
            setDeletingEdges(prev => {
                const newSet = new Set(prev);
                newSet.delete(edgeId);
                return newSet;
            });
        }
    }, [edges, setEdges, nodes]);
    
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
    
    // Track when a node has finished moving (on mouse up)
    const onNodeDragStop = useCallback(async (event: React.MouseEvent, node: Node) => {
        console.log(`Node drag stopped for ${node.id}`, node.position);
        
        // Save the final position after drag
        if (node.position) {
            console.log(`Attempting to update node position for ${node.id}:`, node.position);
            
            // The issue might be with how we're passing the position data
            // Let's ensure we're passing it in the format expected by the API
            const updateData = {
                position: {
                    x: node.position.x,
                    y: node.position.y
                }
            };
            
            console.log('Sending update with data:', updateData);
            
            try {
                await GraphApiClient.updateNode(
                    node.type as NodeType,
                    node.id,
                    updateData
                );
                console.log(`Successfully updated position for ${node.type} node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for node ${node.id}:`, error);
            }
        }
    }, []);
    
    // Custom handler for node changes to intercept position changes and deletions
    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            // Process node changes
            changes.forEach((change) => {
                if (change.type === 'remove' && !deletingNodes.has(change.id)) {
                    // Handle node deletion asynchronously
                    handleNodeDelete(change.id);
                } else if (change.type === 'position' && change.position && !updatingNodePositions.has(change.id)) {
                    // Handle position change
                    handleNodePositionChange(change);
                }
            });
            
            // Apply all changes to the UI immediately
            onNodesChange(changes);
        },
        [handleNodeDelete, deletingNodes, handleNodePositionChange, updatingNodePositions, onNodesChange]
    );
    
    // Custom handler for edge changes to intercept deletions
    const handleEdgesChange = useCallback(
        (changes: any) => {
            // Process edge removals
            changes.forEach((change: any) => {
                if (change.type === 'remove' && !deletingEdges.has(change.id)) {
                    // Handle edge deletion asynchronously
                    handleEdgeDelete(change.id);
                }
            });
            
            // Apply all changes to the UI immediately
            onEdgesChange(changes);
        },
        [handleEdgeDelete, deletingEdges, onEdgesChange]
    );
    
    // Handle new connections
    const onConnect = useCallback(async (connection: Connection) => {
        // Check if an edge already exists between these nodes
        const existingEdge = edges.find(
            edge => edge.source === connection.source && edge.target === connection.target
        );
        
        if (existingEdge) {
            console.log('Edge already exists between these nodes:', existingEdge);
            return; // Don't create a duplicate edge
        }
        
        // Add the edge to the UI immediately for better UX
        const newEdge = addEdge(connection, edges);
        setEdges(newEdge);
        
        try {
            // Create a unique ID for the edge
            const edgeId = `edge-${crypto.randomUUID()}`;
            
            // Determine edge type and label based on the handles
            let edgeType = 'default';
            let edgeLabel = 'Connection';
            
            // If sourceHandle is provided, use it to determine edge type
            if (connection.sourceHandle) {
                edgeType = connection.sourceHandle;
                edgeLabel = connection.sourceHandle === 'knowledge' ? 'Knowledge Base' : 'Roadmap';
            }
            // If targetHandle is provided and sourceHandle is not, use targetHandle
            else if (connection.targetHandle) {
                edgeType = connection.targetHandle;
                edgeLabel = connection.targetHandle === 'knowledge' ? 'Knowledge Base' : 'Roadmap';
            }
            
            // Create the edge data
            const edgeData = {
                id: edgeId,
                source: connection.source,
                target: connection.target,
                type: edgeType,
                data: {
                    label: edgeLabel,
                }
            };
            
            console.log('Creating edge in database:', edgeData);
            
            // Determine the source node type to know which handler to use
            const sourceNode = nodes.find(node => node.id === connection.source);
            if (!sourceNode) {
                console.warn(`Source node not found for connection, skipping edge creation`);
                return;
            }
            
            const createdEdge = await GraphApiClient.createEdge(sourceNode.type as NodeType, edgeData);
            console.log(`${sourceNode.type} edge created in database:`, createdEdge);
            
            // Update the edge in the UI with the data from the database
            setEdges(currentEdges => 
                currentEdges.map(edge => 
                    edge.source === connection.source && 
                    edge.target === connection.target && 
                    !edge.id.startsWith('edge-') 
                        ? { ...edge, id: createdEdge.id, data: createdEdge.data }
                        : edge
                )
            );
        } catch (error) {
            console.error('Error creating edge:', error);
            setError(`Failed to create edge: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [edges, setEdges, nodes]);

    return (
      <div className={`h-full w-full`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
            <div className="text-foreground">Loading graph data...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute top-4 right-4 p-4 bg-destructive text-destructive-foreground rounded-md z-10">
            {error}
            <button 
              className="ml-2 text-xs underline" 
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          fitView
          className="bg-background text-foreground"
          // Figma-style controls
          panOnScroll
          selectionOnDrag
          panOnDrag={panOnDragButtons}
          selectionMode={SelectionMode.Partial}
          zoomActivationKeyCode="Meta"
          // Optional: Disable default behaviors
          zoomOnScroll={true}
          zoomOnDoubleClick={false}
          zoomOnPinch={true}
          // Optional: Configure default edge options
          defaultEdgeOptions={{
            type: 'default', // or 'bezier', 'step', etc.
            animated: true,
            style: { stroke: 'currentColor', strokeWidth: 2 },
          }}
          // Optional: Configure connection line style
          connectionLineStyle={{ stroke: 'currentColor', strokeWidth: 2 }}
          // Optional: Configure connection validation
          connectOnClick={true}
          minZoom={0.1}
          maxZoom={4}
        >
          <Console />
          <Background
            variant={BackgroundVariant.Dots}
            gap={32}
            size={1}
            className="!text-foreground/5"
          />
        </ReactFlow>
      </div>
    );
}