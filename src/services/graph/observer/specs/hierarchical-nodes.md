# Hierarchical Node Relationships Specification

## Overview

This specification outlines the implementation of hierarchical parent-child relationships for nodes in the Cerebro graph system, starting with Feature nodes. This enhancement will allow large features to be broken down into smaller, more manageable sub-features while maintaining cost and time tracking relationships.

## Problem Statement

Feature nodes currently represent atomic units of work with fixed time estimates. When features exceed our time limits, they need to be split into smaller components. We need a mechanism for:

1. Creating parent-child relationships between nodes
2. Automatically rolling up metrics (cost, time, resources) from children to parent nodes
3. Maintaining this pattern in a way that's reusable across multiple node types

## Technical Design

### 1. Data Model Extensions

#### Node Data Enhancement

```typescript
interface HierarchicalNodeRelationship {
  parentId: string | null;
  childIds: string[];
  isRollup: boolean; // Flag to indicate if this node aggregates child values
}

interface EnhancedNodeData {
  // Existing fields remain unchanged
  hierarchy?: HierarchicalNodeRelationship;
  originalEstimate?: number; // Direct estimate for this node
  rollupEstimate?: number; // Calculated from children
}
```

#### New Edge Type

Add a new edge type `PARENT_CHILD` that can be used between any nodes of the same type:

```typescript
export enum EdgeTypes {
  // Existing edge types
  PARENT_CHILD = 'PARENT_CHILD'
}

interface ParentChildEdgeData {
  edgeType: EdgeTypes.PARENT_CHILD;
  rollupContribution: boolean; // Whether this child contributes to parent metrics
}
```

### 2. Node Manifest System Extensions

#### New Common Fields

Add to the CommonFields in the node manifest:

```typescript
export const CommonFields: Record<string, DataField> = {
  // Existing fields
  PARENT_ID: {
    id: 'parentId',
    name: 'Parent Node',
    description: 'ID of the parent node',
    path: 'hierarchy.parentId',
    critical: true
  },
  CHILD_IDS: {
    id: 'childIds',
    name: 'Child Nodes',
    description: 'IDs of child nodes',
    path: 'hierarchy.childIds',
    critical: true
  },
  IS_ROLLUP: {
    id: 'isRollup',
    name: 'Is Rollup Node',
    description: 'Whether this node aggregates values from children',
    path: 'hierarchy.isRollup',
    critical: true
  },
  ROLLUP_ESTIMATE: {
    id: 'rollupEstimate',
    name: 'Rollup Estimate',
    description: 'Calculated estimate from child nodes',
    path: 'rollupEstimate',
    critical: true
  }
};
```

### 3. Update Propagation System

Enhance the NodeObserver to handle hierarchical updates:

1. When a child node is updated, publish updates to the parent node
2. Parent nodes will recalculate aggregated values automatically
3. Events should cascade up the hierarchy

```typescript
// Pseudocode for node observer behavior
function handleNodeUpdate(nodeId: string, nodeType: string, updatedFields: string[]) {
  // Existing update logic
  
  // If hierarchy-related fields are updated
  if (containsHierarchyFields(updatedFields)) {
    // Handle parent-child relationship changes
    updateParentChildRelationships(nodeId, nodeType);
  }
  
  // If this node has a parent and metrics changed
  if (hasParent() && containsMetricFields(updatedFields)) {
    // Trigger update in parent to recalculate rollups
    notifyParentOfMetricChanges(nodeId, nodeType);
  }
}
```

### 4. API Endpoints

Add new API endpoints for managing parent-child relationships:

```http
// Create parent-child relationship
POST /graph/{nodeType}/{parentId}/children
Content-Type: application/json

{
  "childId": "string",
  "rollupContribution": true
}

// Get all children of a node
GET /graph/{nodeType}/{nodeId}/children

// Get parent of a node
GET /graph/{nodeType}/{nodeId}/parent

// Remove parent-child relationship
DELETE /graph/{nodeType}/{parentId}/children/{childId}
```

### 5. UI Components

Create reusable UI components for hierarchical node management:

1. `HierarchySelector` - For setting parent/child relationships
2. `RollupSummary` - For displaying aggregated metrics from children
3. `ChildNodeList` - For listing and managing child nodes

## Implementation Strategy

1. Implement data model changes
2. Extend node manifest system
3. Enhance observer pattern for hierarchical updates
4. Implement API endpoints
5. Create UI components
6. Apply pattern to Feature nodes
7. Add tests and documentation
8. Gradually extend to other node types (Milestone, Option, Meta)

## Example Usage

### Feature Node Hierarchy

```typescript
// Parent feature
const parentFeature = {
  id: 'feature-1',
  title: 'User Authentication System',
  description: 'Complete authentication system implementation',
  hierarchy: {
    parentId: null,
    childIds: ['feature-1-1', 'feature-1-2', 'feature-1-3'],
    isRollup: true
  },
  originalEstimate: 0, // No direct estimate
  rollupEstimate: 60 // Calculated from children
};

// Child features
const childFeature1 = {
  id: 'feature-1-1',
  title: 'Login Implementation',
  description: 'Implement user login functionality',
  hierarchy: {
    parentId: 'feature-1',
    childIds: [],
    isRollup: false
  },
  originalEstimate: 20,
  rollupEstimate: 20 // Same as original (no children)
};

// Additional child features would follow the same pattern
```

## Backward Compatibility

Existing nodes without hierarchy information will continue to function normally. The hierarchy fields are optional, allowing gradual adoption of the new pattern.

## Performance Considerations

1. Limit hierarchy depth to prevent excessive cascading updates
2. Implement caching for rollup calculations
3. Batch updates when multiple children change simultaneously
4. Use memoization in UI components to prevent unnecessary re-renders

## Testing Plan

1. Unit tests for rollup calculations
2. Integration tests for update propagation
3. API endpoint tests
4. UI component tests
5. Performance tests for large hierarchies

## Future Extensions

This pattern can be extended to support:

1. Different types of rollup calculations (sum, average, max, etc.)
2. Custom aggregation rules per node type
3. Cross-node-type hierarchical relationships
4. Visualization of node hierarchies 