# Hierarchical Nodes

This document explains how to use the hierarchical node feature in Cerebro, which allows you to create parent-child relationships between nodes of the same type, starting with Feature nodes.

## Overview

Hierarchical nodes enable:

- Breaking down large features into smaller, more manageable sub-features
- Automatically rolling up metrics (time estimates, costs) from children to parent nodes
- Visualizing complex work hierarchies with proper cost attribution

## Using Hierarchical Features

### Creating a Parent-Child Relationship

1. Navigate to a Feature node
2. In the Feature panel, find the "Hierarchical Relationships" section
3. To make a node a child of another node:
   - Select a parent from the dropdown
   - Click "Apply"
4. To make a node a parent of other nodes:
   - In the "Child Nodes" section, select another node from the dropdown
   - Click "Add Child"

### Rollup Behavior

When you establish a parent-child relationship:

- Parent nodes are automatically marked as "rollup" nodes
- Child nodes contribute their metrics (time, cost) to the parent
- The parent displays both its own direct metrics and the rolled-up totals

### Time Estimate Calculations

Parent nodes display:

- **Direct Estimate**: The time required for work directly on this feature
- **Total Estimate**: Combined direct estimate plus all child contributions
- **Child Contributions**: The portion of the estimate coming from child nodes

### Removing Relationships

To remove a parent-child relationship:

- To remove a parent: Select "None" from the parent dropdown
- To remove a child: Click the "Remove" button next to the child in the list

## Use Cases

### 1. Breaking Down Large Features

When a feature is too large to estimate or complete in a single sprint:

1. Create a parent feature representing the overall capability
2. Create multiple child features representing manageable work units
3. Assign the children to the parent
4. Distribute time estimates across the children

### 2. Maintaining Feature Hierarchies

For projects with complex feature hierarchies:

1. Create a top-level "epic" feature
2. Create mid-level "story" features as children
3. Create task-level features as children of stories
4. Assign metrics at the most appropriate level

### 3. Resource Allocation Across Complex Work

To track resource allocation across complex work:

1. Set up the feature hierarchy
2. Assign team resources at the appropriate level (parent or child)
3. Monitor the rollup calculations to see total resource needs

## Technical Notes

### API Endpoints

The following API endpoints are available for hierarchical feature management:

- `GET /api/graph/feature/{id}/children` - Get all children of a feature
- `POST /api/graph/feature/{id}/children` - Create a parent-child relationship
- `GET /api/graph/feature/{id}/parent` - Get the parent of a feature
- `DELETE /api/graph/feature/{id}/children/{childId}` - Remove a parent-child relationship

### UI Components

The following UI components are available:

- `HierarchySelector` - For setting parent/child relationships
- `RollupSummary` - For displaying aggregated metrics from children
- `ChildNodeList` - For listing and managing child nodes

## Best Practices

1. **Depth Limitations**: Limit hierarchy depth to 3 levels (epic > story > task) for best performance
2. **Clarity in Breakdown**: Ensure each child represents a clear, distinct part of the parent
3. **Appropriate Estimates**: Place estimates at the appropriate level of specificity
4. **Unique Ownership**: Avoid having the same node as a child of multiple parents 