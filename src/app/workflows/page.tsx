"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Clock, Check, AlertTriangle, Pause } from 'lucide-react';
import { useSynapso } from '@/hooks/useSynapso';
import { WorkflowStatus } from '@/types/synapso';
import { toast } from 'sonner';

export default function WorkflowsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const { workflows, loading, error, fetchWorkflows, createWorkflow } = useSynapso();
  
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);
  
  const handleCreateWorkflow = async () => {
    setIsCreating(true);
    try {
      const newWorkflow = await createWorkflow({
        name: `New Workflow ${new Date().toLocaleDateString()}`,
        description: 'A workflow created with Cerebro and Synapso',
        status: WorkflowStatus.DRAFT,
      });
      
      if (newWorkflow?.id) {
        toast.success('Workflow created successfully');
        window.location.href = `/workflows/${newWorkflow.id}`;
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
      toast.error('Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };
  
  const getStatusBadge = (status: WorkflowStatus) => {
    switch (status) {
      case WorkflowStatus.ACTIVE:
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Active</Badge>;
      case WorkflowStatus.PAUSED:
        return <Badge className="bg-yellow-500"><Pause className="h-3 w-3 mr-1" /> Paused</Badge>;
      case WorkflowStatus.COMPLETED:
        return <Badge className="bg-blue-500"><Check className="h-3 w-3 mr-1" /> Completed</Badge>;
      case WorkflowStatus.FAILED:
        return <Badge className="bg-red-500"><AlertTriangle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case WorkflowStatus.DRAFT:
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>;
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading workflows...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 max-w-md bg-destructive/10 rounded-lg">
          <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Workflows</h2>
          <p className="mb-4">{error.message}</p>
          <Button onClick={() => fetchWorkflows()}>Retry</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">Manage your Synapso workflows</p>
        </div>
        <Button onClick={handleCreateWorkflow} disabled={isCreating}>
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating...
            </>
          ) : (
            <>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Workflow
            </>
          )}
        </Button>
      </div>
      
      {workflows.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <h2 className="text-xl font-medium mb-2">No workflows found</h2>
          <p className="text-muted-foreground mb-4">Get started by creating your first workflow</p>
          <Button onClick={handleCreateWorkflow} disabled={isCreating}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Link href={`/workflows/${workflow.id}`} key={workflow.id}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{workflow.name}</CardTitle>
                    {getStatusBadge(workflow.status)}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {workflow.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p>Created: {new Date(workflow.createdAt).toLocaleDateString()}</p>
                    <p>Last updated: {new Date(workflow.updatedAt).toLocaleDateString()}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" className="w-full">Open Workflow</Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 