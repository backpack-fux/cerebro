"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useReactFlow, 
  ReactFlowProvider, 
  Node, 
  Edge,
  NodeChange,
  applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/nodes';
import { Button } from '@/components/ui/button';
import { useSynapso } from '@/hooks/useSynapso';
import { toast } from 'sonner';
import { ThreePanelLayout } from '@/components/layout/ThreePanelLayout';
import { UtilityPanel } from '@/components/utility/UtilityPanel';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { WorkflowNode } from '@/types/synapso';
import { AlertTriangle } from 'lucide-react';

export default function WorkflowLayout() {
  const params = useParams();
  // Ensure id is a string and handle null case with a default
  const workflowId = params?.id ? String(params.id) : 'offline-workflow';
  
  return (
    <ReactFlowProvider>
      <WorkflowPage id={workflowId} />
    </ReactFlowProvider>
  );
}

function WorkflowPage({ id }: { id: string }) {
  const { fitView, getNodes, setNodes } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isSpaceKeyDown, setIsSpaceKeyDown] = useState<boolean>(false);
  
  // Use the Synapso hook to interact with the API
  const { 
    nodes,
    edges,
    currentWorkflow,
    loading: isLoading, 
    error,
    isOffline,
    fetchWorkflow,
    fetchNodes,
    fetchEdges,
    createNode,
    updateNode
  } = useSynapso({ 
    workflowId: id, 
    enableRealtime: true,
    useOfflineFallback: true // Enable offline fallback
  });
  
  // Space key handling for Figma-style panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpaceKeyDown(true);
        document.body.classList.add('space-pan-active');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceKeyDown(false);
        document.body.classList.remove('space-pan-active');
      }
    };
    
    // Clean up function to prevent cursor issues if user switches tabs while space is down
    const handleBlur = () => {
      setIsSpaceKeyDown(false);
      document.body.classList.remove('space-pan-active');
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.body.classList.remove('space-pan-active');
    };
  }, []);
  
  // Initialize the workflow data
  useEffect(() => {
    const loadWorkflowData = async () => {
      try {
        await fetchWorkflow(id);
        await fetchNodes(id);
        await fetchEdges(id);
      } catch (err) {
        console.error('Failed to load workflow:', err);
        toast.error('Failed to load workflow data');
      }
    };
    
    loadWorkflowData();
  }, [id, fetchWorkflow, fetchNodes, fetchEdges]);
  
  // Fit view when data is loaded
  useEffect(() => {
    if (nodes.length > 0 && !isLoading) {
      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    }
  }, [nodes, isLoading, fitView]);
  
  // Handle node selection
  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    const foundNode = nodes.find(n => n.id === node.id);
    setSelectedNode(foundNode || null);
  };
  
  // Handle node creation
  const handleCreateNode = useCallback(async (type: string) => {
    try {
      // Map logical types to actual node component types
      let nodeType;
      let nodeTitle;
      
      if (type === 'workflow') {
        nodeType = 'synapsoTeam';
        nodeTitle = 'New Team';
      } else if (type === 'logic') {
        nodeType = 'synapsoLogic';
        nodeTitle = 'New Logic Node';
      } else if (type === 'teamMember') {
        nodeType = 'synapsoTeamMember';
        nodeTitle = 'New Team Member';
      } else {
        nodeType = 'synapsoTeam'; // Default fallback
        nodeTitle = 'New Node';
      }
      
      const newNode = await createNode({
        type: nodeType,
        position: { x: 100, y: 100 },
        data: {
          title: nodeTitle,
          description: `A new ${type} node`,
          workflowId: id,
        },
      });
      
      if (newNode) {
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} node created`);
      } else if (isOffline) {
        toast.error(`Cannot create node while offline`);
      }
    } catch (err) {
      console.error(`Failed to create ${type} node:`, err);
      toast.error(`Failed to create ${type} node`);
    }
  }, [createNode, id, isOffline]);
  
  // Handle node drag end
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // Only update position if node has actually moved
    if (node.position) {
      console.log(`Node ${node.id} moved to:`, node.position);
      
      // Update node position in Synapso or locally
      if (!isOffline) {
        updateNode(node.id, {
          position: node.position
        });
      }
      // In offline mode position updates happen automatically through ReactFlow state
    }
  }, [updateNode, isOffline]);

  // Handle node changes (position, selection, etc)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Apply all changes to the local React Flow state
    setNodes((nds) => applyNodeChanges(changes, nds));
    
    // For position changes that are completed (not during drag), sync with backend
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        if (!isOffline && 'id' in change) {
          updateNode(change.id, {
            position: change.position
          });
        }
      }
    });
  }, [setNodes, isOffline, updateNode]);
  
  // Render the workflow canvas
  const renderFlowCanvas = () => {
    // Display loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg">Loading workflow...</p>
          </div>
        </div>
      );
    }
    
    // Display error state (only if not offline)
    if (error && !isOffline) {
      let errorTitle = "Error Loading Workflow";
      let errorMessage = error.message;
      
      // Check for specific error types
      if (errorMessage.includes("OFFLINE") || errorMessage.includes("SERVICE_DOWN")) {
        errorTitle = "Service Unavailable";
        errorMessage = "The Synapso service is currently unavailable. You can continue working in offline mode, but changes won't be saved to the server.";
      } else if (errorMessage.includes("TIMEOUT")) {
        errorTitle = "Connection Timeout";
        errorMessage = "The Synapso service is taking too long to respond. Please try again later.";
      }
      
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6 max-w-md bg-destructive/10 rounded-lg">
            <h2 className="text-xl font-bold text-destructive mb-2">{errorTitle}</h2>
            <p className="mb-4">{errorMessage}</p>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
              <Button 
                onClick={() => {
                  // Force offline mode
                  localStorage.setItem('synapso-prefer-offline', 'true');
                  window.location.reload();
                }}
              >
                Work Offline
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    // Show offline banner if in offline mode
    const OfflineBanner = isOffline ? (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-yellow-500/90 text-black px-4 py-2 rounded-md flex items-center gap-2 shadow-lg">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">Working in offline mode. Changes will not be saved.</span>
        <Button 
          variant="default" 
          size="sm"
          onClick={() => {
            // Clear offline preference and attempt reconnection
            localStorage.removeItem('synapso-prefer-offline');
            window.location.reload();
          }}
          className="ml-2 bg-yellow-600 hover:bg-yellow-700 h-7 text-xs"
        >
          Try Reconnect
        </Button>
      </div>
    ) : null;
    
    // Render ReactFlow
    return (
      <>
        {OfflineBanner}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
          fitView
          className={`react-flow-canvas ${isSpaceKeyDown ? 'space-pan-active' : ''}`}
          panOnScroll={false}
          panOnDrag={isSpaceKeyDown ? true : [1]} // Enable drag panning when space is down
          selectionOnDrag={!isSpaceKeyDown} // Disable selection box when space is down
          elementsSelectable={!isSpaceKeyDown} // Disable selection when space is down
          nodesDraggable={true} // Explicitly enable node dragging
          zoomOnDoubleClick={false}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
          selectionKeyCode={null}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background className="react-flow-background" />
          <Controls 
            className="react-flow-controls" 
            showInteractive={false}
            position="bottom-right"
          />
          <MiniMap 
            className="react-flow-minimap"
            nodeColor={(node) => {
              // Use HSL variables to ensure theme compatibility
              return node.type === 'synapsoTeam' ? 'hsl(var(--chart-1))' : 
                     node.type === 'synapsoLogic' ? 'hsl(var(--chart-2))' : 
                     node.type === 'synapsoTeamMember' ? 'hsl(var(--chart-3))' : 
                     'hsl(var(--muted))';
            }}
            maskColor="var(--rf-minimap-mask)"
            nodeStrokeWidth={3}
            style={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
            }}
            position="bottom-right"
          />
        </ReactFlow>
      </>
    );
  };
  
  return (
    <ThreePanelLayout
      canvas={renderFlowCanvas()}
      utilityPanel={
        <UtilityPanel 
          selectedNode={selectedNode}
          workflowId={id}
          onCreateNode={handleCreateNode}
        />
      }
      chatInterface={
        <ChatInterface workflowId={id} isOffline={isOffline} />
      }
      isOffline={isOffline}
    />
  );
} 