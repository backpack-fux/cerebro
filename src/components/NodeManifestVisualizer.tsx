'use client';

import React, { useState, useEffect } from 'react';
import { NodeManifests, getNodeManifest, getSubscribedFields, DataField } from '@/services/graph/observer/node-manifest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";

/**
 * Component to visualize the node manifest relationships
 */
export default function NodeManifestVisualizer() {
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get all node types from the manifest
  const nodeTypes = Object.keys(NodeManifests);

  // Set colors based on theme
  const isDarkTheme = resolvedTheme === 'dark';
  const nodeColor = isDarkTheme ? '#2d3748' : '#e2e8f0';
  const selectedNodeColor = isDarkTheme ? '#4a5568' : '#cbd5e0';
  const textColor = isDarkTheme ? '#ffffff' : '#000000';
  const lineColor = isDarkTheme ? '#a0aec0' : '#718096';

  const renderDataFlow = () => {
    return (
      <div className="mt-4">
        <div className="relative overflow-x-auto">
          <div className="w-full overflow-auto">
            <svg 
              width="1000" 
              height="500" 
              className="border rounded min-w-[1000px]" 
              style={{ background: 'transparent' }}
              viewBox="0 0 1000 500"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Draw node types as circles */}
              {nodeTypes.map((nodeType, index) => {
                // Calculate positions based on the number of nodes to ensure they fit
                const totalWidth = Math.max(1000, nodeTypes.length * 200);
                const spacing = totalWidth / (nodeTypes.length + 1);
                const x = spacing * (index + 1);
                const y = 150;
                return (
                  <g key={nodeType}>
                    <circle 
                      cx={x} 
                      cy={y} 
                      r="50" 
                      fill={nodeType === selectedNodeType ? selectedNodeColor : nodeColor}
                      stroke={lineColor}
                      strokeWidth="2"
                      onClick={() => setSelectedNodeType(nodeType)}
                      style={{ cursor: 'pointer' }}
                    />
                    <text 
                      x={x} 
                      y={y} 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fontWeight="bold"
                      fill={textColor}
                    >
                      {nodeType}
                    </text>
                    
                    {/* Draw subscription arrows */}
                    {selectedNodeType === nodeType && 
                      NodeManifests[nodeType].subscribes.nodeTypes.map(subscribedType => {
                        const targetIndex = nodeTypes.indexOf(subscribedType);
                        if (targetIndex === -1) return null;
                        
                        const targetX = spacing * (targetIndex + 1);
                        const targetY = 100;
                        
                        // Calculate arrow points
                        const angle = Math.atan2(targetY - y, targetX - x);
                        const sourceX = x + 50 * Math.cos(angle);
                        const sourceY = y + 50 * Math.sin(angle);
                        const endX = targetX - 50 * Math.cos(angle);
                        const endY = targetY - 50 * Math.sin(angle);
                        
                        return (
                          <g key={`${nodeType}-${subscribedType}`}>
                            <defs>
                              <marker
                                id={`arrowhead-${nodeType}-${subscribedType}`}
                                markerWidth="10"
                                markerHeight="7"
                                refX="0"
                                refY="3.5"
                                orient="auto"
                              >
                                <polygon points="0 0, 10 3.5, 0 7" fill={lineColor} />
                              </marker>
                            </defs>
                            <line
                              x1={sourceX}
                              y1={sourceY}
                              x2={endX}
                              y2={endY}
                              stroke={lineColor}
                              strokeWidth="2"
                              markerEnd={`url(#arrowhead-${nodeType}-${subscribedType})`}
                            />
                            <text 
                              x={(sourceX + endX) / 2} 
                              y={(sourceY + endY) / 2 - 10} 
                              textAnchor="middle" 
                              dominantBaseline="middle"
                              fontSize="12"
                              fill={textColor}
                              className="px-1"
                            >
                              subscribes
                            </text>
                          </g>
                        );
                      })
                    }
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Scroll horizontally if needed to see all nodes. Click on a node to see its subscription relationships.
          </p>
        </div>
      </div>
    );
  };

  const renderManifestDetails = () => {
    return (
      <div className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodeTypes.map(nodeType => (
            <div 
              key={nodeType} 
              className={`p-4 border rounded ${selectedNodeType === nodeType ? 'border-primary' : ''}`}
              onClick={() => setSelectedNodeType(nodeType)}
              style={{ cursor: 'pointer' }}
            >
              <h3 className="text-lg font-semibold mb-2">{nodeType}</h3>
              <div>
                <h4 className="font-medium mt-2">Publishes:</h4>
                <ul className="list-disc pl-5">
                  {NodeManifests[nodeType].publishes.fields.map((field: DataField) => (
                    <li key={field.id} className="flex items-center gap-2">
                      <span>{field.name}</span>
                      {field.critical && (
                        <Badge variant="outline" className="text-xs border-orange-500">critical</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mt-2">Subscribes to:</h4>
                <ul className="list-disc pl-5">
                  {NodeManifests[nodeType].subscribes.nodeTypes.map(subscribedType => (
                    <li key={subscribedType}>{subscribedType}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Add a new render function for documentation
  const renderDocumentation = () => {
    return (
      <div className="mt-4 space-y-6">
        <div className="p-4 border rounded">
          <h4 className="text-lg font-semibold mb-2">What is the Node Data Manifest System?</h4>
          <p className="mb-2">
            The Node Data Manifest System is a structured approach to manage data dependencies between different node types in our application.
            It defines what data each node type can publish and what data it can subscribe to from other nodes.
          </p>
          <p>
            This system helps to clarify data flow between nodes, ensure consistent updates across the application,
            provide documentation for developers, and reduce bugs related to data synchronization.
          </p>
        </div>
        
        <div className="p-4 border rounded">
          <h4 className="text-lg font-semibold mb-2">Supported Node Types</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Team Member:</strong> Represents individual team members with skills, capacity, and rates.
            </li>
            <li>
              <strong>Team:</strong> Represents a group of team members with collective bandwidth and capabilities.
            </li>
            <li>
              <strong>Feature:</strong> Represents a product feature with build type, duration, and requirements.
            </li>
            <li>
              <strong>Option:</strong> Represents a strategic option (build, buy, partner) with goals, risks, and resource allocations.
            </li>
            <li>
              <strong>Provider:</strong> Represents an external provider with costs, due diligence items, and team allocations.
            </li>
            <li>
              <strong>Milestone:</strong> Represents a project milestone with KPIs, costs, and value metrics.
            </li>
            <li>
              <strong>Meta:</strong> Represents a knowledge or roadmap node that connects other nodes with metadata.
            </li>
          </ul>
        </div>
        
        <div className="p-4 border rounded">
          <h4 className="text-lg font-semibold mb-2">Key Concepts</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Node Type:</strong> A specific type of node in the application (e.g., Feature, Team, Team Member, Option, Provider).
            </li>
            <li>
              <strong>Data Field:</strong> A specific piece of data that a node can publish or subscribe to (e.g., title, description, status).
            </li>
            <li>
              <strong>Publishing:</strong> When a node updates its data and notifies subscribers of the change.
            </li>
            <li>
              <strong>Subscribing:</strong> When a node listens for updates from another node type.
            </li>
            <li>
              <strong>Critical Fields:</strong> Fields that trigger immediate updates when changed.
            </li>
          </ul>
        </div>
        
        <div className="p-4 border rounded">
          <h4 className="text-lg font-semibold mb-2">Benefits</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Real-time Updates:</strong> Changes in one node are immediately reflected in connected nodes.
            </li>
            <li>
              <strong>Reduced Bugs:</strong> Clear data dependencies help prevent synchronization issues.
            </li>
            <li>
              <strong>Better Developer Experience:</strong> Documentation and visualization make it easier to understand the system.
            </li>
            <li>
              <strong>Type Safety:</strong> TypeScript integration ensures type safety when working with node data.
            </li>
          </ul>
        </div>
        
        <div className="p-4 border rounded">
          <h4 className="text-lg font-semibold mb-2">How to Use</h4>
          <p className="mb-2">
            When implementing a new node type or modifying an existing one:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Define the data fields the node will publish in the node manifest.</li>
            <li>Specify which node types and fields the node will subscribe to.</li>
            <li>Use the <code>useNodeObserver</code> hook to publish updates and subscribe to other nodes.</li>
            <li>Handle updates appropriately in your node hook.</li>
          </ol>
        </div>
      </div>
    );
  };

  const renderDebugView = () => {
    return (
      <div className="mt-4 space-y-6">
        <div>
          <h4 className="text-lg font-semibold mb-2">Raw Manifest Data</h4>
          <pre className="p-4 border rounded bg-muted overflow-auto max-h-[500px]">
            {JSON.stringify(NodeManifests, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="text-lg font-semibold mb-2">Usage Examples</h4>
          <div className="space-y-4">
            <div className="p-4 border rounded">
              <h5 className="font-medium mb-2">Publishing Updates</h5>
              <pre className="p-3 bg-muted rounded text-sm overflow-x-auto">
{`// In your node hook (e.g., useFeatureNode.ts)
import { useNodeObserver } from '@/hooks/useNodeObserver';
import { NodeUpdateType } from '@/services/graph/observer/node-observer';

// Initialize the publisher
const { publishUpdate } = useNodeObserver<YourNodeDataType>();

// When data changes
const handleDataChange = (newData) => {
  // Update local state
  setNodeData(newData);
  
  // Publish the update to subscribers
  publishUpdate({
    type: NodeUpdateType.CONTENT,
    affectedFields: ['title', 'description'],
    data: newData
  });
}`}
              </pre>
            </div>
            
            <div className="p-4 border rounded">
              <h5 className="font-medium mb-2">Subscribing to Updates</h5>
              <pre className="p-3 bg-muted rounded text-sm overflow-x-auto">
{`// In your node hook (e.g., useFeatureNode.ts)
import { useNodeObserver } from '@/hooks/useNodeObserver';

// Subscribe to updates from another node type
useEffect(() => {
  if (!id) return;
  
  // Subscribe to team node updates
  const unsubscribe = subscribeToNodeUpdates(
    'team',
    (update) => {
      // Handle the update
      console.log('Received update from team node:', update);
      
      // Check if this update affects fields we care about
      if (
        update.type === NodeUpdateType.CONTENT &&
        update.affectedFields?.includes('title')
      ) {
        // Update your local state based on the received data
        // ...
      }
    }
  );
  
  // Clean up subscription
  return () => {
    unsubscribe();
  };
}, [id, subscribeToNodeUpdates]);`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!mounted) {
    return <div className="p-8 text-center">Loading Node Manifest Visualizer...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Node Data Manifest System</CardTitle>
        <CardDescription>
          Visualize how different node types publish and subscribe to data.
          Click on a node to see its relationships with other nodes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="visualization" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="visualization">Visualization</TabsTrigger>
            <TabsTrigger value="details">Manifest Details</TabsTrigger>
            <TabsTrigger value="documentation">Documentation</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
          </TabsList>
          
          <TabsContent value="visualization">
            <h3 className="text-lg font-semibold mb-4">Data Flow Visualization</h3>
            {renderDataFlow()}
          </TabsContent>
          
          <TabsContent value="details">
            <h3 className="text-lg font-semibold mb-4">Node Manifest Details</h3>
            {renderManifestDetails()}
          </TabsContent>
          
          <TabsContent value="documentation">
            <h3 className="text-lg font-semibold mb-4">Documentation</h3>
            {renderDocumentation()}
          </TabsContent>
          
          <TabsContent value="debug">
            <h3 className="text-lg font-semibold mb-4">Debug Utilities</h3>
            {renderDebugView()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 