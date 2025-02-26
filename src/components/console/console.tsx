"use client";

import { Panel } from "@xyflow/react";
import { Box, Flag, Puzzle, Users, User, Building2, GitFork, Calendar, Code, StickyNote } from "lucide-react";
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
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'code', label: 'Code', icon: Code },
  { type: 'notes', label: 'Notes', icon: StickyNote },
] as const;

interface ConsoleProps {
  createNode: (type: string, label: string) => Promise<void>;
  isCreatingNode: Record<string, boolean>;
}

export function Console({ createNode, isCreatingNode }: ConsoleProps) {
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
            disabled={isCreatingNode[type]}
            title={`Add ${label}`}
            className="h-10 w-10 rounded-md aspect-square shrink-0 text-muted-foreground dark:text-muted-foreground/60 hover:text-foreground"
          >
            {isCreatingNode[type] ? (
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