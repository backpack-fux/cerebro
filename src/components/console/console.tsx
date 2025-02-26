"use client";

import { Panel } from "@xyflow/react";
import { Box, Flag, Puzzle, Users, User, Building2, GitFork, Calendar, Code, StickyNote } from "lucide-react";
import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { GraphApiClient } from "@/services/graph/neo4j/api-client";
import { NodeType } from "@/services/graph/neo4j/api-urls";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Node type definitions with their respective icons and labels
const nodeTypes = [
  { type: 'meta', label: 'Meta', icon: Box },
  { type: 'milestone', label: 'Milestone', icon: Flag },
  { type: 'feature', label: 'Feature', icon: Puzzle },
  { type: 'team', label: 'Team', icon: Users },
  { type: 'teamMember', label: 'Member', icon: User },
  { type: 'provider', label: 'Provider', icon: Building2 },
  { type: 'option', label: 'Option', icon: GitFork },
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'code', label: 'Code', icon: Code },
  { type: 'notes', label: 'Notes', icon: StickyNote },
] as const;

export function Console() {
  const { addNodes, getViewport } = useReactFlow();
  const [isCreating, setIsCreating] = useState<Record<string, boolean>>({});

  const createNode = useCallback(async (type: string, label: string) => {
    // Prevent multiple clicks while creating
    if (isCreating[type]) return;
    
    try {
      // Set loading state for this button
      setIsCreating(prev => ({ ...prev, [type]: true }));
      
      const { x, y, zoom } = getViewport();
      
      // Calculate center of current viewport
      const position = {
        x: -x / zoom + window.innerWidth / 2 / zoom,
        y: -y / zoom + window.innerHeight / 2 / zoom
      };

      // Adjust position to center the node
      const nodePosition = { 
        x: position.x - 100, 
        y: position.y - 50 
      };

      // Create the node directly in the database first
      const createdNode = await GraphApiClient.createNode(type as NodeType, {
        title: `New ${label}`,
        description: `A new ${label.toLowerCase()} node`,
        position: nodePosition,
      });
      
      console.log(`${type} node created in database:`, createdNode);
      
      // Add the node to the UI only after successful creation
      const permanentNode = {
        ...createdNode,
        position: nodePosition, // Use the original position to avoid jumps
      };
      
      addNodes(permanentNode);
      
      // Show success message
      toast(`Successfully created a new ${label} node.`, {
        description: `The ${label.toLowerCase()} node has been added to the canvas.`,
      });
    } catch (error) {
      console.error(`Error creating ${type} node:`, error);
      
      // Show error message
      toast.error(`Failed to create ${label} node`, {
        description: `${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      // Clear loading state
      setIsCreating(prev => ({ ...prev, [type]: false }));
    }
  }, [addNodes, getViewport, isCreating]);

  return (
    <Panel 
      position="bottom-left" 
      className="m-4 bg-background/95 dark:bg-muted/30 p-2 rounded-lg border shadow-sm"
    >
      <div className="grid grid-cols-3 gap-2 w-[180px]">
        {nodeTypes.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant="ghost"
            size="icon"
            onClick={() => createNode(type, label)}
            disabled={isCreating[type]}
            title={`Add ${label}`}
            className="h-10 w-10 rounded-md aspect-square shrink-0 text-muted-foreground dark:text-muted-foreground/60 hover:text-foreground"
          >
            {isCreating[type] ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </Button>
        ))}
      </div>
    </Panel>
  );
}