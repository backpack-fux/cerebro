"use client";

import { Controls, ControlButton } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

export function Console() {
  const { addNodes, getViewport } = useReactFlow();

  const addMetaNode = useCallback(() => {
    const { x, y, zoom } = getViewport();
    
    // Calculate center of current viewport
    const position = {
      x: -x / zoom + window.innerWidth / 2 / zoom,
      y: -y / zoom + window.innerHeight / 2 / zoom
    };

    const newNode = {
      id: `meta-${Date.now()}`,
      type: 'meta',
      position: { x: position.x - 100, y: position.y - 50 }, // Offset by half the node size
      data: { title: 'New Meta Node' },
    };

    addNodes(newNode);
  }, [addNodes, getViewport]);

  return (
    <Controls 
      position="bottom-left"
      showInteractive={false}
      className="!bg-background/80 !border-border hover:!bg-background/90 !rounded-md !shadow-sm gap-1 [&>button]:!text-foreground [&>button:hover]:!bg-muted"
    >
      <ControlButton 
        onClick={addMetaNode}
        title="Add Meta Node"
        className="p-2 rounded-md"
      >
        <Plus className="h-4 w-4" />
      </ControlButton>
      {/* Add more ControlButtons here for other node types */}
    </Controls>
  );
} 