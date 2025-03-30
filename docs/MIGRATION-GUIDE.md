# Migration Guide: Neo4j to Synapso

This document outlines the process of migrating node components from direct Neo4j interaction to the Synapso backend API.

## Overview

Cerebro has been refactored to be a lightweight client for the Synapso backend service. This migration involves:

1. Removing direct Neo4j database access
2. Replacing the observer pattern with real-time events from Synapso
3. Converting node components to use the Synapso API client
4. Implementing offline support for better user experience

## Development Environment Setup

Before starting migration, ensure you have:

1. Installed Bun: `curl -fsSL https://bun.sh/install | bash`
2. Updated dependencies: `bun install`
3. Configured Synapso environment variables in `.env.local`

## Migration Steps for Node Components

Follow these steps when converting each legacy node type to a Synapso-based node:

### 1. Create a Custom Hook

Create a new hook in `src/hooks/useSynapso[NodeType].ts` that uses the Synapso API client:

```typescript
// Example: src/hooks/useSynapsoFeatureNode.ts
import { useCallback, useState } from 'react';
import { useSynapso } from './useSynapso';

export function useSynapsoFeatureNode(id: string, workflowId: string) {
  // Extract data with defaults and handle type casting
  const { nodes, updateNode, deleteNode } = useSynapso({ 
    workflowId, 
    enableRealtime: true 
  });
  
  // Find the current node data
  const nodeData = nodes.find(n => n.id === id)?.data || {};
  
  // State and handlers
  const [title, setTitle] = useState((nodeData as any).title || 'Feature Node');
  
  // Update node data function
  const updateNodeData = async (newTitle: string) => {
    try {
      await updateNode(id, {
        data: {
          ...nodeData,
          title: newTitle,
        }
      });
    } catch (error) {
      console.error('Failed to update feature node:', error);
    }
  };
  
  // Other handlers and business logic
  
  return {
    title,
    // Other state and methods
    handleTitleChange: (newTitle: string) => {
      setTitle(newTitle);
      updateNodeData(newTitle);
    },
    // Other handler functions
  };
}
```

### 2. Create a Synapso Node Component

Create a new component in `src/components/nodes/synapso-[node-type].tsx`:

```tsx
// Example: src/components/nodes/synapso-feature-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { NodeHeader } from '@/components/nodes/node-header';
import { memo } from "react";
import { useSynapsoFeatureNode } from '@/hooks/useSynapsoFeatureNode';

const SynapsoFeatureNode = memo(function SynapsoFeatureNode({ id, data, selected }: NodeProps) {
  // Extract the workflowId from data
  const workflowId = (data as any)?.workflowId || '';
  
  // Use our custom Synapso hook
  const feature = useSynapsoFeatureNode(id, workflowId);
  
  return (
    <BaseNode selected={selected}>
      {/* Node implementation */}
    </BaseNode>
  );
});

export { SynapsoFeatureNode };
```

### 3. Update the Node Registry

Add the new Synapso node to `src/components/nodes/index.ts`:

```typescript
import { SynapsoFeatureNode } from "./synapso-feature-node";

export const nodeTypes = {
  // Add your new node type
  synapsoFeature: SynapsoFeatureNode,
  
  // Other node types
} as const;
```

### 4. Update UI Components to Use New Node Type

When creating nodes via the UI, use the new node type:

```typescript
await createNode({
  type: 'synapsoFeature', // Use the new Synapso node type
  position: { x: 100, y: 100 },
  data: {
    title: 'New Feature',
    workflowId: id,
  },
});
```

## Testing

1. Run the development server with `bun dev`
2. Test the node in both online and offline modes
3. Verify that real-time updates work correctly when connected
4. Check that the UI gracefully handles connection issues

## Benefits of Migration

- **Simplified Code**: No direct database interactions in the frontend
- **Better Separation of Concerns**: UI components focus on rendering and user interactions
- **Offline Support**: Application remains usable even without a backend connection
- **Real-time Updates**: Consistent state across all clients

## Best Practices

- Use TypeScript interfaces for type safety
- Implement optimistic updates for better user experience
- Handle errors gracefully with user feedback
- Add appropriate loading states
- Make the UI responsive to offline/online status changes 