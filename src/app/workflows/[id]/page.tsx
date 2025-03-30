"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ReactFlow, Background, Controls, MiniMap, useReactFlow, ReactFlowProvider, Node } from '@xyflow/react';
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

export default function WorkflowLayout({ params }: { params: { id: string } }) {
  return (
    <ReactFlowProvider>
      <WorkflowPage id={params.id} />
    </ReactFlowProvider>
  );
}

function WorkflowPage({ id }: { id: string }) {
  const { fitView } = useReactFlow();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  
  // Use the Synapso hook to interact with the API
  const {
    nodes,
    edges,
    currentWorkflow,
    loading,
    error,
    isOffline,
    fetchWorkflow,
    fetchNodes,
    fetchEdges,
    createNode,
  } = useSynapso({ 
    workflowId: id, 
    enableRealtime: true,
    useOfflineFallback: true // Enable offline fallback
  });
  
  // Initialize the workflow data
  useEffect(() => {
    const loadWorkflowData = async () => {
      setIsLoading(true);
      try {
        await fetchWorkflow(id);
        await fetchNodes(id);
        await fetchEdges(id);
      } catch (err) {
        console.error('Failed to load workflow:', err);
        toast.error('Failed to load workflow data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWorkflowData();
  }, [id, fetchWorkflow, fetchNodes, fetchEdges]);
  
  // Fit view when data is loaded
  useEffect(() => {
    if (nodes.length > 0 && !loading) {
      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    }
  }, [nodes, loading, fitView]);
  
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
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6 max-w-md bg-destructive/10 rounded-lg">
            <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Workflow</h2>
            <p className="mb-4">{error.message}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      );
    }
    
    // Show offline banner if in offline mode
    const OfflineBanner = isOffline ? (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-yellow-500/90 text-black px-4 py-2 rounded-md flex items-center gap-2 shadow-lg">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">Working in offline mode. Changes will not be saved.</span>
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
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
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
        <ChatInterface workflowId={id} />
      }
      isOffline={isOffline}
    />
  );
} 