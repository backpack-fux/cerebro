"use client";

import { Panel } from "@xyflow/react";
import { 
  Box, 
  Flag, 
  Puzzle, 
  Users, 
  User, 
  Building2, 
  GitFork 
} from "lucide-react";
import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";

// Node type definitions with their respective icons and labels
const nodeTypes = [
  { type: 'meta', label: 'Meta', icon: Box },
  { type: 'milestone', label: 'Milestone', icon: Flag },
  { type: 'feature', label: 'Feature', icon: Puzzle },
  { type: 'team', label: 'Team', icon: Users },
  { type: 'teamMember', label: 'Member', icon: User },
  { type: 'provider', label: 'Provider', icon: Building2 },
  { type: 'option', label: 'Option', icon: GitFork },
] as const;

export function Console() {
  const { addNodes, getViewport } = useReactFlow();

  const createNode = useCallback((type: string, label: string) => {
    const { x, y, zoom } = getViewport();
    
    // Calculate center of current viewport
    const position = {
      x: -x / zoom + window.innerWidth / 2 / zoom,
      y: -y / zoom + window.innerHeight / 2 / zoom
    };

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: position.x - 100, y: position.y - 50 },
      data: { title: `New ${label}` },
    };

    addNodes(newNode);
  }, [addNodes, getViewport]);

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
            title={`Add ${label}`}
            className="h-10 w-10 rounded-md aspect-square shrink-0 text-muted-foreground dark:text-muted-foreground/60 hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </Panel>
  );
} 