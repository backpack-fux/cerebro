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
} from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { Console } from "@/components/console/console";
import { useCallback } from "react";

// Configure panning buttons (1 = middle mouse, 2 = right mouse)
const panOnDragButtons = [1, 2];

export default function Canvas() {
    const [nodes, , onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    
    // Handle new connections
    const onConnect = useCallback((connection: Connection) => {
        setEdges((eds) => addEdge(connection, eds));
    }, [setEdges]);

    return (
      <div className={`h-full w-full`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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