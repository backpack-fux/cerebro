import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react';
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RFMetaNode } from '@/services/graph/meta/meta.types';
import { MetaHandlers } from '@/services/graph/meta/meta.handlers';

// MetaNode component
export function MetaNode({ id, data, selected }: NodeProps<RFMetaNode>) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(data.title);
    setDescription(data.description || '');
  }, [data.title, data.description]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    // Update local state immediately for responsive UI
    setTitle(newTitle);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, title: newTitle });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newTitle !== data.title) {
          // Persist the change to the database
          await MetaHandlers.update({ 
            id, 
            title: newTitle 
          });
          console.log(`Updated node ${id} title to "${newTitle}"`);
        }
      } catch (error) {
        console.error(`Failed to update node ${id}:`, error);
      }
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    // Update local state immediately for responsive UI
    setDescription(newDescription);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, description: newDescription });
    
    // Clear any existing debounce timer
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }
    
    // Set a new debounce timer
    descriptionDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newDescription !== data.description) {
          // Persist the change to the database
          await MetaHandlers.update({ 
            id, 
            description: newDescription 
          });
          console.log(`Updated node ${id} description`);
        }
      } catch (error) {
        console.error(`Failed to update node ${id} description:`, error);
      }
      descriptionDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    };
  }, []);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    // Optionally delete associated edges
    const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
    connectedEdges.forEach((edge) => {
      MetaHandlers.deleteMetaEdge(edge.id).catch((error) => console.error('Failed to delete edge:', error));
    });
  }, [id, setNodes, edges]);

  // Handle edge connection (create edge when connecting nodes)
  const onConnect = useCallback((params: any) => {
    // This function is now empty because edge creation is handled by the Canvas component
    // We're keeping the function to maintain the component's API
    console.log('Meta node onConnect called, but edge creation is handled by Canvas component');
  }, []);

  // Handle edge disconnection (delete edge when disconnected)
  const handleDisconnect = useCallback((edgeId: string) => {
    MetaHandlers.deleteMetaEdge(edgeId)
      .then(() => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      })
      .catch((error) => console.error('Failed to delete edge:', error));
  }, [setEdges]);

  // Optionally display connected edges in the UI
  const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={title}
            onChange={handleTitleChange}
            className="bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Meta Title"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Meta node menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
            {/* Optional: Add edge management actions */}
            {connectedEdges.map((edge) => (
              <DropdownMenuItem
                key={edge.id}
                onSelect={() => handleDisconnect(edge.id)}
                className="cursor-pointer text-red-500"
              >
                Disconnect {edge.data?.label as string || 'Edge'}
              </DropdownMenuItem>
            ))}
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      {/* Add description textarea */}
      <div className="p-2">
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          className="w-full bg-transparent outline-none resize-none text-sm placeholder:text-muted-foreground"
          placeholder="Add a description..."
          rows={2}
        />
      </div>

      {/* Input/Output Handles with onConnect for edge creation */}
      <Handle
        type="source"
        position={Position.Top}
        id="knowledge"
        title="Knowledge Base"
        onConnect={onConnect}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        title="Roadmap"
        id="roadmap"
        onConnect={onConnect}
      />
    </BaseNode>
  );
}