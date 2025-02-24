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
import { useCallback } from 'react';
import { RFMetaEdge, RFMetaNode } from '@/services/graph/meta/meta.types';
import { MetaHandlers } from '@/services/graph/meta/meta.handlers';

// MetaNode component
export function MetaNode({ id, data, selected }: NodeProps<RFMetaNode>) {
  const { updateNodeData, setNodes, getEdges, setEdges } = useReactFlow();
  const edges = useEdges();

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

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
    const { source, target, sourceHandle, targetHandle } = params;
    if (source === id || target === id) {
      const edge: RFMetaEdge = {
        id: `edge-${crypto.randomUUID()}`,
        source: source === id ? id : target,
        target: target === id ? id : source,
        type: sourceHandle === 'source' ? 'knowledge' : 'roadmap', // Match handle IDs to edge types
        data: {
          label: sourceHandle === 'source' ? 'Knowledge Base' : 'Roadmap',
        },
      };
      MetaHandlers.createMetaEdge(edge)
        .then((savedEdge) => {
          setEdges((eds) => [...eds, savedEdge]);
        })
        .catch((error) => console.error('Failed to create edge:', error));
    }
  }, [id, setEdges]);

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
            value={data.title}
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

      {/* Input/Output Handles with onConnect for edge creation */}
      <Handle
        type="source"
        position={Position.Top}
        id="source"
        title="Knowledge Base"
        onConnect={onConnect}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        title="Roadmap"
        id="target"
        onConnect={onConnect}
      />
    </BaseNode>
  );
}