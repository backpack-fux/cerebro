'use client';

import NodeManifestVisualizer from '@/components/NodeManifestVisualizer';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default function NodeManifestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Node Data Manifest System</h1>
          <p className="text-muted-foreground mt-2">
            A visualization and documentation tool for the node data publication and subscription system
          </p>
        </div>
        <ThemeToggle />
      </div>
      
      <div className="prose dark:prose-invert max-w-none mb-8">
        <h2>About the Node Data Manifest System</h2>
        <p>
          The Node Data Manifest System provides a structured approach to manage data dependencies between different node types in our application.
          It defines what data each node type can publish and what data it can subscribe to from other nodes.
        </p>
        <p>
          This system helps to:
        </p>
        <ul>
          <li>Clarify data flow between nodes</li>
          <li>Ensure consistent updates across the application</li>
          <li>Provide documentation for developers</li>
          <li>Reduce bugs related to data synchronization</li>
        </ul>
        <p>
          Use the visualization below to explore the relationships between different node types and understand how data flows through the system.
        </p>
      </div>
      
      <div className="bg-card rounded-lg border shadow-sm">
        <NodeManifestVisualizer />
      </div>
    </div>
  );
} 