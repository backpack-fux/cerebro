# Node Data Manifest System

This document explains how to use the Node Data Manifest System for managing data dependencies and updates between different node types in the application.

## Overview

The Node Data Manifest System provides a structured way to define:

1. What data each node type can publish
2. What data each node type can subscribe to
3. How to easily extend this for new node types or data fields

This system makes it clear which data is being published and subscribed to, improving maintainability and making it easier to extend the application.

## Key Components

### 1. Node Manifests

The manifest for each node type is defined in `src/services/graph/observer/node-manifest.ts`. Each manifest specifies:

- **Fields the node publishes**: What data this node makes available to other nodes
- **Node types it subscribes to**: Which other node types this node listens to
- **Fields it subscribes to**: Which specific fields from other node types it cares about

### 2. Enhanced Node Observer

The `useNodeObserver` hook in `src/hooks/useNodeObserver.ts` has been enhanced to:

- Automatically subscribe to updates based on the manifest
- Publish updates according to the manifest
- Determine update criticality based on the manifest

### 3. Visualization and Debugging

The system includes:

- **Node Manifest Visualizer**: A component that visualizes the relationships between node types
- **Debug Utilities**: Functions to help understand data flow and troubleshoot issues

## How to Use

### Publishing Updates

When a node needs to publish an update, use the `publishManifestUpdate` function:

```typescript
// In a node hook (e.g., useTeamMemberNode)
const { publishManifestUpdate } = useNodeObserver<RFTeamMemberNodeData>(id, 'teamMember');

// When updating a field
const handleTitleChange = useCallback((title: string) => {
  // Update local state
  updateNodeData(id, { ...data, title });
  
  // Publish the update according to the manifest
  publishManifestUpdate(
    { ...data, title },  // The updated data
    ['title'],           // The field IDs from the manifest that changed
    { source: 'ui' }     // Optional metadata
  );
  
  // Save to backend
  saveToBackend({ title });
}, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);
```

### Subscribing to Updates

To subscribe to updates based on the manifest:

```typescript
// In a node hook (e.g., useFeatureNode)
const { subscribeBasedOnManifest } = useNodeObserver<RFFeatureNodeData>(id, 'feature');

// Subscribe to updates based on the manifest
useEffect(() => {
  // Subscribe based on the manifest
  const { refresh, unsubscribe } = subscribeBasedOnManifest();
  
  // Handle node data updates
  const handleNodeDataUpdated = (event: Event) => {
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail;
    
    // Only process events for this node
    if (detail.subscriberId !== id) return;
    
    // Handle updates based on publisher type and fields
    if (detail.publisherType === 'team' && 
        detail.relevantFields.includes('title')) {
      // Update local state based on the received data
      // ...
    }
  };
  
  window.addEventListener('nodeDataUpdated', handleNodeDataUpdated);
  
  return () => {
    unsubscribe();
    window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated);
  };
}, [id, subscribeBasedOnManifest]);
```

## Visualizing Node Relationships

You can use the Node Manifest Visualizer to understand the relationships between different node types:

1. Navigate to `/node-manifest` in your application
2. Click on a node type to see:
   - What fields it publishes
   - What node types it subscribes to
   - What fields it subscribes to from each node type
3. The visualization shows arrows indicating subscription relationships

## Debugging Data Flow

The system includes utilities to help debug data flow:

```typescript
import { debugNodeUpdate } from '@/services/graph/observer/node-manifest';

// Log information about a data update
debugNodeUpdate('team', 'team-123', ['title', 'roster']);
```

This will log:
- The affected fields
- Which fields are critical
- Which node types might be interested in this update

## Extending the System

### Adding a New Field

To add a new field to a node type:

1. Add the field definition to the appropriate field collection in `node-manifest.ts`:

```typescript
export const TeamFields = {
  // ... existing fields
  NEW_FIELD: {
    id: 'newField',
    name: 'New Field',
    description: 'Description of the new field',
    path: 'newField',
    critical: true // Set to true if changes should trigger immediate updates
  }
};
```

2. Add the field to the node's manifest:

```typescript
export const NodeManifests: Record<string, NodeManifest> = {
  team: {
    publishes: {
      fields: [
        // ... existing fields
        TeamFields.NEW_FIELD
      ]
    },
    // ... rest of manifest
  }
};
```

### Adding a New Node Type

To add a new node type:

1. Create field definitions for the new node type:

```typescript
export const NewNodeFields = {
  FIELD_1: {
    id: 'field1',
    name: 'Field 1',
    description: 'Description of field 1',
    path: 'field1',
    critical: true
  },
  // ... more fields
};
```

2. Add the node type's manifest:

```typescript
export const NodeManifests: Record<string, NodeManifest> = {
  // ... existing node types
  newNodeType: {
    publishes: {
      fields: [
        CommonFields.TITLE,
        CommonFields.DESCRIPTION,
        NewNodeFields.FIELD_1,
        // ... more fields
      ]
    },
    subscribes: {
      nodeTypes: ['team', 'feature'], // Node types this node subscribes to
      fields: {
        team: ['title', 'roster'],
        feature: ['title', 'buildType']
      }
    }
  }
};
```

## Utility Functions

The system provides several utility functions:

- `getNodeManifest(nodeType)`: Get the manifest for a specific node type
- `doesNodePublish(nodeType, fieldId)`: Check if a node type publishes a specific field
- `doesNodeSubscribeTo(subscriberType, publisherType)`: Check if a node subscribes to another node type
- `getSubscribedFields(subscriberType, publisherType)`: Get the fields a node subscribes to
- `isFieldCritical(nodeType, fieldId)`: Check if a field is marked as critical
- `getFieldDetails(nodeType, fieldId)`: Get detailed information about a field
- `getSubscribersForField(publisherType, fieldId)`: Get all node types that subscribe to a field
- `debugNodeUpdate(publisherType, publisherId, affectedFields)`: Debug a data update

## Benefits

- **Clear Documentation**: The manifest serves as self-documenting code for node data dependencies
- **Type Safety**: The system enforces type safety for published and subscribed data
- **Maintainability**: Makes it easier to understand and maintain the data flow between nodes
- **Extensibility**: Provides a structured way to add new node types and fields
- **Performance**: Optimizes updates by only processing relevant fields and determining criticality
- **Visualization**: Helps developers understand the relationships between different node types
- **Debugging**: Provides tools to troubleshoot data flow issues 