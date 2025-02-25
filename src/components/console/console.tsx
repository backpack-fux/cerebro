"use client";

import { Panel } from "@xyflow/react";
import { 
  Box, 
  Flag, 
  Puzzle, 
  Users, 
  User, 
  Building2, 
  GitFork,
  Calendar,
  Code,
  StickyNote
} from "lucide-react";
import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { MetaHandlers } from "@/services/graph/meta/meta.handlers";

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
  const { addNodes, setNodes, getNodes, getViewport } = useReactFlow();
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

      // Create a temporary node to show immediately in the UI
      const tempId = `${type}-${Date.now()}`;
      const newNode = {
        id: tempId,
        type,
        position: nodePosition,
        data: { 
          title: `New ${label}`,
          description: `A new ${label.toLowerCase()} node`,
          isTemporary: true // Mark as temporary for easier detection
        },
      };

      // Add the node to the UI immediately for better UX
      addNodes(newNode);

      // Only make API call for meta nodes for now
      if (type === 'meta') {
        try {
          // Use MetaHandlers to create the node in the database
          const createdNode = await MetaHandlers.create({
            title: `New ${label}`,
            description: `A new ${label.toLowerCase()} node`,
            position: nodePosition,
          });
          
          console.log('Node created in database:', createdNode);
          
          // Remove the temporary node and add the permanent one
          const currentNodes = getNodes();
          
          // Ensure the position is correctly preserved
          const permanentNode = {
            ...createdNode,
            position: nodePosition, // Use the original position to avoid jumps
            data: {
              ...createdNode.data,
              isTemporary: false // Mark as permanent
            }
          };
          
          console.log('Replacing temporary node with permanent node:', {
            tempId,
            permanentNode
          });
          
          setNodes(
            currentNodes
              .filter(node => node.id !== tempId) // Remove the temporary node
              .concat(permanentNode)
          );
        } catch (error) {
          console.error('Error creating node in database:', error);
          // Keep the temporary node visible since the API call failed
        }
      }
    } catch (error) {
      console.error('Error creating node:', error);
      // You could add error handling UI here
    } finally {
      // Clear loading state
      setIsCreating(prev => ({ ...prev, [type]: false }));
    }
  }, [addNodes, setNodes, getNodes, getViewport, isCreating]);

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