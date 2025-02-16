"use client";

import { 
    ReactFlow, 
    Controls, 
    Background, 
    SelectionMode, 
    BackgroundVariant,
    addEdge,
    useEdgesState,
    useNodesState
  } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/base-node";
import { useCallback } from "react";

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
          <Controls 
            position="bottom-right"
            showInteractive={false}
            className="!bg-background/80 !border !border-foreground/10 !rounded-md !shadow-sm p-1"
          />
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