# Architecture Overview

## System Components

### 1. Node Data Manifest System

The Node Data Manifest System is a core architectural component that manages data dependencies and updates between different node types in the application. It provides a structured way to define:

1. What data each node type can publish
2. What data each node type can subscribe to
3. How to easily extend this for new node types or data fields

### Key Components

#### 1. Node Manifests
Each node type has its manifest defined in `src/services/graph/observer/node-manifest.ts`, specifying:
- Fields the node publishes
- Node types it subscribes to
- Fields it subscribes to from other nodes

#### 2. Enhanced Node Observer
The `useNodeObserver` hook in `src/hooks/useNodeObserver.ts` provides:
- Automatic subscription to updates based on manifest
- Publishing updates according to manifest
- Update criticality determination

#### 3. Visualization and Debugging
The system includes:
- Node Manifest Visualizer component
- Debug utilities for data flow troubleshooting

### Data Flow

1. **Publishing Updates**
   - Nodes publish updates using `publishManifestUpdate`
   - Updates include changed fields and metadata
   - Critical fields trigger immediate updates

2. **Subscribing to Updates**
   - Nodes subscribe based on manifest definitions
   - Updates are filtered by relevance
   - Subscribers receive only relevant field changes

3. **Resource Management**
   - Special handling for team resource allocations
   - Consistent resource availability across nodes
   - Resource contention resolution

### Benefits

- **Clear Documentation**: Self-documenting code for node data dependencies
- **Type Safety**: Enforced type safety for published/subscribed data
- **Maintainability**: Structured data flow between nodes
- **Extensibility**: Easy addition of new node types and fields
- **Performance**: Optimized updates based on field criticality
- **Visualization**: Interactive relationship visualization
- **Debugging**: Built-in tools for troubleshooting

### Integration with Other Systems

The Node Data Manifest System integrates with:

1. **Team Resource Management**
   - Manages resource allocation across work nodes
   - Ensures consistent resource availability
   - Handles resource contention

2. **Node Observer Pattern**
   - Implements publish-subscribe pattern
   - Manages real-time updates
   - Handles data synchronization

3. **Visualization System**
   - Provides interactive node relationship views
   - Helps developers understand data flow
   - Supports debugging and maintenance

### 2. Team Resource Observer

The Team Resource Observer manages resource allocation across the system:

- **Resource Tracking**: Centralized tracking of team resources and allocations
- **Contention Management**: Handling of competing resource requests
- **Real-time Updates**: Immediate reflection of resource changes
- **Consistent Calculations**: Uniform approach to calculating available hours

### 3. Node Types

The system supports several node types, each with specific responsibilities:

1. **Team Member**
   - Individual capacity and skills
   - Time allocation tracking
   - Rate and availability management

2. **Team**
   - Collective bandwidth management
   - Resource allocation
   - Season and sprint planning

3. **Feature**
   - Build type and requirements
   - Duration and dependencies
   - Resource needs

4. **Option**
   - Strategic decisions (build/buy/partner)
   - Goals and risks
   - Resource allocations

5. **Provider**
   - External service management
   - Cost structures
   - Due diligence tracking

6. **Milestone**
   - Project tracking
   - KPI monitoring
   - Value metrics

7. **Meta**
   - Knowledge management
   - Roadmap planning
   - Cross-node relationships

### 4. Edge Management

1. **Edge Storage**
   - Edges are stored as Neo4j relationships
   - Each edge has a unique ID
   - Edges maintain type information
   - Properties are stored as JSON strings

2. **Edge Transformation**
   - Neo4j edges use `from/to` properties
   - React Flow edges use `source/target` properties
   - Transformation happens in API layer
   - Type information is preserved

3. **Edge Deduplication**
   - Edges are deduplicated based on source-target pairs
   - Only the most recent edge between nodes is kept
   - The graph API automatically filters duplicates
   - A dedicated utility endpoint handles cleanup

4. **Edge Types**
   - Different relationships use specialized edge types
   - Team relationships have allocation metadata
   - Feature relationships have dependency metadata
   - Edge type determines visual rendering and behavior

## Data Flow

1. **Node Updates**
   - Nodes publish updates through the manifest system
   - Subscribers receive updates in real-time
   - Changes are reflected across connected nodes

2. **Resource Allocation**
   - Work nodes request resources from teams
   - Team Resource Observer manages allocations
   - Updates are propagated to all affected nodes

3. **State Management**
   - Each node maintains its own state
   - State changes trigger appropriate updates
   - Consistency is maintained through the observer system

## Technical Implementation

### Directory Structure

```
src/
├── app/                    # Next.js app directory
├── components/            # React components
├── hooks/                # Custom React hooks
├── services/             # Business logic and services
│   └── graph/           # Graph-related services
│       ├── observer/    # Node observer system
│       └── [node-type]/ # Individual node type services
└── utils/               # Utility functions
```

### Key Technologies

- **Frontend**: Next.js, React, TypeScript
- **State Management**: Custom hooks with React Context
- **Data Storage**: Neo4j for graph data
- **API**: REST endpoints with Next.js API routes
- **Real-time Updates**: Custom event system

### Performance Considerations

1. **Memoization**
   - React components use memoization to prevent unnecessary re-renders
   - Hooks implement proper dependency tracking
   - Data transformations are cached where appropriate

2. **Debouncing**
   - API calls are debounced to prevent excessive requests
   - State updates are batched for better performance
   - Resource calculations are optimized

3. **Lazy Loading**
   - Components are loaded on demand
   - Heavy computations are deferred
   - Data is fetched incrementally

## Future Improvements

1. **Resource Management**
   - Enhanced conflict resolution
   - Priority-based allocation
   - Historical tracking

2. **Performance**
   - Graph query optimization
   - Caching improvements
   - Real-time sync optimization

3. **Developer Experience**
   - Enhanced debugging tools
   - Better visualization options
   - Improved documentation 