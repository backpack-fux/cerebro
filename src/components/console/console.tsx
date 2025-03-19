"use client";

import { Panel } from "@xyflow/react";
import { Box, Flag, Puzzle, Users, User, Building2, GitFork, Calendar, Code, StickyNote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

// Node type definitions with their respective icons and labels
const nodeTypesList = [
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
  const [isDedupingEdges, setIsDedupingEdges] = useState(false);

  const handleDedupeEdges = async () => {
    try {
      setIsDedupingEdges(true);
      const response = await fetch('/api/graph/dedupe-edges');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to dedupe edges: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Edge deduplication complete', {
          description: result.message || `Deleted ${result.deletedEdges?.length || 0} duplicate edges`
        });
        
        // Reload the page to refresh the graph
        window.location.reload();
      } else {
        throw new Error(result.error || 'Unknown error during edge deduplication');
      }
    } catch (error) {
      console.error('Error deduplicating edges:', error);
      toast.error('Edge deduplication failed', {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsDedupingEdges(false);
    }
  };

  return (
    <Panel 
      position="bottom-left" 
      className="m-4 bg-background/95 dark:bg-muted/30 p-2 rounded-lg border shadow-sm"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 w-[180px]">
          {nodeTypesList.map(({ type, label, icon: Icon }) => (
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
        
        <Button
          className="w-full"
          variant="outline"
          onClick={handleDedupeEdges}
          disabled={isDedupingEdges}
          size="sm"
        >
          {isDedupingEdges ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fixing Edges...
            </>
          ) : (
            "Fix Duplicate Edges"
          )}
        </Button>
      </div>
    </Panel>
  );
}