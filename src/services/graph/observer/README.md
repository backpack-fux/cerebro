# Node Data Manifest System

The Node Data Manifest System provides a structured approach to manage data dependencies between different node types in our application. It defines what data each node type can publish and what data it can subscribe to from other nodes.

## Overview

The system consists of:

1. **Individual Node Manifests**: Each node type has its own manifest file that defines what data it publishes and what data it subscribes to.
2. **Base Manifest**: Contains common fields and utilities that can be used by all node types.
3. **Main Manifest**: Combines all individual manifests and provides utility functions for working with the manifests.
4. **Node Observer**: Implements the publish-subscribe pattern for node data updates.

## Directory Structure

```
src/services/graph/
├── base-node/
│   └── base-manifest.ts       # Common fields and utilities
├── team-member/
│   └── team-member.manifest.ts # Team Member specific manifest
├── team/
│   └── team.manifest.ts       # Team specific manifest
├── feature/
│   └── feature.manifest.ts    # Feature specific manifest
├── option/
│   └── option.manifest.ts     # Option specific manifest
├── provider/
│   └── provider.manifest.ts   # Provider specific manifest
├── milestone/
│   └── milestone.manifest.ts  # Milestone specific manifest
├── meta/
│   └── meta.manifest.ts       # Meta specific manifest
└── observer/
    ├── node-manifest.ts       # Main manifest that combines all individual manifests
    └── node-observer.ts       # Implementation of the publish-subscribe pattern
```

## Key Concepts

- **Node Type**: A specific type of node in the application (e.g., Feature, Team, Team Member, Option, Provider).
- **Data Field**: A specific piece of data that a node can publish or subscribe to (e.g., title, description, status).
- **Publishing**: When a node updates its data and notifies subscribers of the change.
- **Subscribing**: When a node listens for updates from another node type.
- **Critical Fields**: Fields that trigger immediate updates when changed.

## Supported Node Types

The system currently supports the following node types:

1. **Team Member**: Represents individual team members with skills, capacity, and rates.
2. **Team**: Represents a group of team members with collective bandwidth and capabilities.
3. **Feature**: Represents a product feature with build type, duration, and requirements.
4. **Option**: Represents a strategic option (build, buy, partner) with goals, risks, and resource allocations.
5. **Provider**: Represents an external provider with costs, due diligence items, and team allocations.
6. **Milestone**: Represents a project milestone with KPIs, costs, and value metrics.
7. **Meta**: Represents a knowledge or roadmap node that connects other nodes with metadata.

## Usage

### Defining a New Node Type

1. Create a new manifest file for your node type in its directory:

```typescript
// src/services/graph/your-node/your-node.manifest.ts
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createField } from '@/services/graph/base-node/base-manifest';

// Define your node specific fields
export const YourNodeFields: Record<string, DataField> = {
  FIELD_1: {
    id: 'field1',
    name: 'Field 1',
    description: 'Description of field 1',
    path: 'field1',
    critical: true
  },
  // Add more fields as needed
};

// Define what your node publishes
export const YourNodePublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    YourNodeFields.FIELD_1,
    // Add more fields as needed
  ]
};

// Define what your node subscribes to
export const YourNodeSubscribes = {
  nodeTypes: ['otherNode'] as NodeType[],
  fields: {
    otherNode: ['field1', 'field2']
  }
};

// Export the complete manifest
export const YourNodeManifest = {
  publishes: YourNodePublishes,
  subscribes: YourNodeSubscribes
};
```

2. Update the main manifest file to include your node type:

```typescript
// src/services/graph/observer/node-manifest.ts
import { YourNodeManifest, YourNodeFields } from '@/services/graph/your-node/your-node.manifest';

// Re-export the field definitions
export { YourNodeFields };

// Add your node type to the NodeManifests object
export const NodeManifests: Record<string, NodeManifest> = {
  // Existing node types
  teamMember: TeamMemberManifest,
  team: TeamManifest,
  feature: FeatureManifest,
  
  // Your new node type
  yourNode: YourNodeManifest
};
```

### Publishing Updates

In your node hook (e.g., useYourNode.ts):

```typescript
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
    affectedFields: ['field1', 'field2'],
    data: newData
  });
};
```

### Subscribing to Updates

In your node hook (e.g., useYourNode.ts):

```typescript
import { useNodeObserver } from '@/hooks/useNodeObserver';

// Subscribe to updates from another node type
useEffect(() => {
  if (!id) return;
  
  // Subscribe to updates from another node type
  const unsubscribe = subscribeToNodeUpdates(
    'otherNode',
    (update) => {
      // Handle the update
      console.log('Received update from other node:', update);
      
      // Check if this update affects fields we care about
      if (
        update.type === NodeUpdateType.CONTENT &&
        update.affectedFields?.includes('field1')
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
}, [id, subscribeToNodeUpdates]);
```

## Benefits

- **Real-time Updates**: Changes in one node are immediately reflected in connected nodes.
- **Reduced Bugs**: Clear data dependencies help prevent synchronization issues.
- **Better Developer Experience**: Documentation and visualization make it easier to understand the system.
- **Type Safety**: TypeScript integration ensures type safety when working with node data.

## Visualization

You can view the Node Data Manifest System visualization at `/node-manifest` in the application. This provides a visual representation of the data dependencies between different node types.

# Team Resource Observer Pattern

This directory contains the implementation of the observer pattern for managing team resource allocations across different work nodes (feature, option, provider) in the application.

## Overview

The team resource observer pattern ensures consistent resource allocation across all node types by:

1. Centralizing resource allocation logic in a single place
2. Providing a single source of truth for team resource availability
3. Handling resource contention between different work nodes
4. Ensuring consistent calculation of available hours

## Files

- `node-observer.ts`: Base observer pattern implementation for all node types
- `team-resource-observer.ts`: Implementation of the observer pattern for team resources
- `team-resource-integration.ts`: Helper functions for integrating with work nodes
- `team-resource-observer.md`: Detailed documentation of the observer pattern

## Integration Files

- `src/services/graph/team/team-resource-integration.ts`: Integration with the team service
- `src/services/graph/feature/feature-resource-integration.ts`: Integration with the feature service
- `src/services/graph/option/option-resource-integration.ts`: Integration with the option service

## Shared Utilities

- `src/utils/allocation/node-capacity.ts`: Shared utility for calculating node capacity

## How It Works

1. **Team Resources**: When a team is created or updated, its resources are initialized in the observer
2. **Work Node Connection**: When a work node connects to a team, it subscribes to resource updates
3. **Resource Allocation**: When a work node allocates resources, it requests them from the observer
4. **Resource Updates**: When team resources change, all subscribed work nodes are notified

## Usage

### Team Service

```typescript
// Initialize team resources
initializeTeamResources(teamNode);

// Set up team to publish resource updates
setupTeamResourcePublishing(teamId);

// Update team resources when roster changes
updateTeamRoster(teamId, roster);
```

### Feature/Option Service

```typescript
// Connect to team resources
connectFeatureToTeam(featureNode, teamId, handleTeamResourceUpdate);

// Update resource allocation
updateFeatureResourceAllocation(featureId, teamId, memberAllocations, projectDurationDays);

// Get available hours for a member
getFeatureMemberAvailableHours(featureId, teamId, memberId, memberData, projectDurationDays);

// Disconnect from team resources
disconnectFeatureFromTeam(featureId, teamId);
```

## Benefits

1. **Consistency**: All work nodes show the same available hours for team members
2. **Resource Contention**: The system properly handles multiple nodes competing for resources
3. **Single Source of Truth**: No more data inconsistencies between different node types
4. **Simplified Maintenance**: Centralized logic makes future changes easier

## Implementation Details

The observer pattern is built on top of the existing `NodeObserver` system, using the `NodeUpdateType.ALLOCATION` event type for resource allocation updates.

When a team's resources change, it publishes an update that all subscribed work nodes receive, allowing them to update their UI and internal state accordingly.

## Future Improvements

1. **Conflict Resolution**: Add UI for resolving resource allocation conflicts
2. **Resource Visualization**: Add visualization of resource usage across work nodes
3. **Allocation Priorities**: Add priority levels for different types of work nodes
4. **Historical Tracking**: Track resource allocation changes over time 