// MetaNode.tsx (updated)
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
import { API_URLS } from '@/services/graph/neo4j/api-urls'; // Import API_URLS

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
    setTitle(newTitle);
    updateNodeData(id, { ...data, title: newTitle });
    
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(async () => {
      try {
        if (newTitle !== data.title) {
          const response = await fetch(`${API_URLS['meta']}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }),
          });

          if (!response.ok) throw new Error(`Failed to update meta node: ${response.status} ${response.statusText}`);
          
          console.log(`Updated node ${id} title to "${newTitle}"`);
        }
      } catch (error) {
        console.error(`Failed to update node ${id}:`, error);
      }
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    updateNodeData(id, { ...data, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      try {
        if (newDescription !== data.description) {
          const response = await fetch(`${API_URLS['meta']}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: newDescription }),
          });

          if (!response.ok) throw new Error(`Failed to update meta node description: ${response.status} ${response.statusText}`);
          
          console.log(`Updated node ${id} description`);
        }
      } catch (error) {
        console.error(`Failed to update node ${id} description:`, error);
      }
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, data, updateNodeData]);
  
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    };
  }, []);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
    connectedEdges.forEach((edge) => {
      fetch(`${API_URLS['meta']}/edges/${edge.id}`, { method: 'DELETE' })
        .catch((error) => console.error('Failed to delete edge:', error));
    });
  }, [id, setNodes, edges]);

  const handleDisconnect = useCallback((edgeId: string) => {
    fetch(`${API_URLS['meta']}/edges/${edgeId}`, { method: 'DELETE' })
      .then(() => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      })
      .catch((error) => console.error('Failed to delete edge:', error));
  }, [setEdges]);

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

      <div className="p-2">
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          className="w-full bg-transparent outline-none resize-none text-sm placeholder:text-muted-foreground"
          placeholder="Add a description..."
          rows={2}
        />
      </div>

      <Handle
        type="source"
        position={Position.Top}
        id="knowledge"
        title="Knowledge Base"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        title="Roadmap"
        id="roadmap"
      />
    </BaseNode>
  );
}