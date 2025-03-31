"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Users, Workflow, Plus, Database, Code, User, Cpu } from "lucide-react";
import { WorkflowNode } from "@/types/synapso";
import { DevTelemetry } from "./DevTelemetry";

interface UtilityPanelProps {
  selectedNode?: WorkflowNode | null;
  workflowId?: string;
  onCreateNode?: (type: string) => void;
}

export function UtilityPanel({ selectedNode, workflowId, onCreateNode }: UtilityPanelProps) {
  const [activeTab, setActiveTab] = useState("nodes");
  
  // Node creation handlers
  const handleCreateWorkflowNode = () => {
    onCreateNode?.("workflow");
  };
  
  const handleCreateLogicNode = () => {
    onCreateNode?.("logic");
  };
  
  const handleCreateTeamMemberNode = () => {
    onCreateNode?.("teamMember");
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Utility Panel</h2>
        <p className="text-sm text-muted-foreground">Configure nodes and workflow settings</p>
      </div>
      
      <Tabs defaultValue="nodes" className="flex-1" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="nodes" className="flex items-center gap-1.5">
            <Workflow className="h-4 w-4" />
            <span>Nodes</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>Agents</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
          <TabsTrigger value="developer" className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4" />
            <span>Developer</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Nodes Tab */}
        <TabsContent value="nodes" className="flex-1">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                onClick={handleCreateWorkflowNode}
                className="h-auto py-4 flex flex-col items-center justify-center gap-1"
              >
                <Workflow className="h-5 w-5 mb-1" />
                <span>Workflow Node</span>
                <span className="text-xs text-muted-foreground">Process flows</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleCreateLogicNode}
                className="h-auto py-4 flex flex-col items-center justify-center gap-1"
              >
                <Code className="h-5 w-5 mb-1" />
                <span>Logic Node</span>
                <span className="text-xs text-muted-foreground">Custom logic</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleCreateTeamMemberNode}
                className="h-auto py-4 flex flex-col items-center justify-center gap-1"
              >
                <User className="h-5 w-5 mb-1" />
                <span>Team Member</span>
                <span className="text-xs text-muted-foreground">Staff resources</span>
              </Button>
            </div>
            
            {selectedNode ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {selectedNode.type === "workflow" ? (
                      <Workflow className="h-4 w-4" />
                    ) : selectedNode.type === "teamMember" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Code className="h-4 w-4" />
                    )}
                    {selectedNode.data.title || 'Untitled Node'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedNode.type} node ({selectedNode.id})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedNode.type}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {selectedNode.status || 'Idle'}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {new Date(selectedNode.createdAt).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm" className="w-full">
                    Edit Node
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <div className="text-center py-8 border rounded-md bg-muted/30">
                <p className="text-sm text-muted-foreground">Select a node to view details</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Agents Tab */}
        <TabsContent value="agents" className="flex-1">
          <div className="space-y-4">
            <Button className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
            
            <div className="text-center py-8 border rounded-md bg-muted/30">
              <p className="text-sm text-muted-foreground">No agents connected</p>
              <p className="text-xs text-muted-foreground mt-1">Agents will appear here when added</p>
            </div>
          </div>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow Settings</CardTitle>
                <CardDescription className="text-xs">
                  Configure workflow behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Workflow ID:</span> {workflowId || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Execution Mode:</span> Sequential
                  </div>
                  <div>
                    <span className="font-medium">Auto-save:</span> Enabled
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full">
                  Edit Settings
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Backend Connection
                </CardTitle>
                <CardDescription className="text-xs">
                  Synapso API status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Connected</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Developer Tab */}
        <TabsContent value="developer" className="flex-1">
          <DevTelemetry />
        </TabsContent>
      </Tabs>
    </div>
  );
} 