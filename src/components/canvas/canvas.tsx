"use client";

import { 
    ReactFlow, 
    Background, 
    SelectionMode, 
    BackgroundVariant,
    useEdgesState,
    useNodesState,
  } from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { Console } from "@/components/console/console";

// Configure panning buttons (1 = middle mouse, 2 = right mouse)
const panOnDragButtons = [1, 2];

export default function Canvas() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    

    return (
      <div className={`h-full w-full`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          className="bg-background text-foreground"
          // Figma-style controls
          panOnScroll
          selectionOnDrag
          panOnDrag={panOnDragButtons}
          selectionMode={SelectionMode.Partial}
          zoomActivationKeyCode="Meta"
          // Optional: Disable default behaviors
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
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