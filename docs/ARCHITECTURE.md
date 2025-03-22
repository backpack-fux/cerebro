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

### 5. Circular Update Prevention

1. **Standardized Duration Handling**
   - All node types use the `useDurationPublishing` hook
   - Consistent pattern to avoid circular update loops
   - Multiple protection mechanisms working together
   - Direct API calls for backend updates
   - Intelligent event filtering

2. **Standardized Member Allocation Handling**
   - All work nodes use the `useMemberAllocationPublishing` hook
   - Consistent handling of team and member allocations
   - Prevents issues with allocation rendering
   - Ensures slider values display correctly
   - Protects against rapid consecutive updates

3. **Update Origin Tracking**
   - System tracks the origin of updates
   - Fields track their last update timestamp
   - Updates are debounced appropriately
   - Self-updates are detected and skipped

4. **Value-Based Triggering**
   - Updates only trigger on actual value changes
   - Redundant updates are eliminated
   - Comparison happens before publishing
   - Update flags prevent simultaneous updates

4. **Isolation by Field**
   - Each field has its own update tracking
   - Critical fields have special handling
   - Separate publishing mechanisms for distinct field types
   - Field update frequency is monitored and limited

### 6. Feature Node Data Flow

#### Overview
The Feature Node implements a standardized data flow for managing properties and allocations, with special handling for team allocations, member allocations, and duration.

#### Data Structure
```typescript
/**
 * @typedef {Object} FeatureNodeData
 * @property {string} title - The display title of the feature
 * @property {string} description - Detailed feature description
 * @property {string} [buildType] - The build approach (e.g., "internal", "external")
 * @property {number} duration - The planned duration in time units
 * @property {string} [timeUnit] - Unit of time measurement (e.g., "days", "weeks")
 * @property {string} [status] - Current feature status (e.g., "planning", "in-progress")
 * @property {string} [startDate] - Planned start date in ISO format
 * @property {string} [endDate] - Planned end date in ISO format
 * @property {TeamMember[]} teamMembers - Array of team members assigned to the feature
 * @property {MemberAllocation[]} memberAllocations - Detailed allocation of team members
 * @property {TeamAllocation[]} teamAllocations - Allocations at the team level
 * @property {string} createdAt - Feature creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */
```

#### Publishing Mechanisms

The Feature node uses specialized hooks for managing different aspects of its data:

1. **Duration Publishing**
   ```typescript
   /**
    * @function useDurationPublishing
    * @description Manages duration updates for feature nodes with protection against circular updates
    * @param {string} nodeId - The ID of the feature node
    * @param {number} initialDuration - Initial duration value
    * @param {function} updateCallback - Optional callback after successful update
    * @returns {Object} Duration state and update functions
    * @property {number} duration - Current duration value
    * @property {function} setDuration - Function to update duration locally
    * @property {function} publishDuration - Function to publish duration to backend
    */
   ```

2. **Member Allocation Publishing**
   ```typescript
   /**
    * @function useMemberAllocationPublishing
    * @description Standardized hook for managing member allocations across feature nodes
    * @param {string} nodeId - The ID of the feature node
    * @param {MemberAllocation[]} initialAllocations - Initial member allocations
    * @param {function} updateCallback - Optional callback after successful update
    * @returns {Object} Allocation state and update functions
    * @property {MemberAllocation[]} allocations - Current member allocations
    * @property {function} setAllocations - Function to update allocations locally
    * @property {function} publishAllocations - Function to publish allocations to backend
    */
   ```

3. **Date Publishing**
   ```typescript
   /**
    * @function useDatePublishing
    * @description Manages start and end date updates for feature nodes
    * @param {string} nodeId - The ID of the feature node
    * @param {Object} initialDates - Initial date values
    * @param {string} initialDates.startDate - Initial start date
    * @param {string} initialDates.endDate - Initial end date
    * @param {function} updateCallback - Optional callback after successful update
    * @returns {Object} Date state and update functions
    * @property {string} startDate - Current start date
    * @property {string} endDate - Current end date
    * @property {function} setDates - Function to update dates locally
    * @property {function} publishDates - Function to publish dates to backend
    */
   ```

#### Data Flow Lifecycle

1. **Initialization**
   - Feature node data is retrieved from the backend API
   - Data is transformed from Neo4j format to React Flow format
   - Specialized hooks initialize with current values
   - Initial state is rendered in the UI

2. **User Interaction**
   - User modifies a feature node property (e.g., duration or allocation)
   - Local state is updated immediately for responsive UI
   - Debounced publishing mechanism is triggered
   - Origin tracking prevents circular updates

3. **Backend Persistence**
   - Changes are sent to backend API endpoints
   - Neo4j database is updated with new values
   - Success/failure is communicated back to the UI
   - Relevant notifications are displayed to the user

4. **Update Propagation**
   - Node manifest system identifies affected nodes
   - Changes are propagated to dependent nodes
   - Team resource system updates resource availability
   - Milestone nodes recalculate costs and timelines

#### Type Transformations

```typescript
/**
 * @function transformFeatureNode
 * @description Transforms feature node data between Neo4j and React Flow formats
 * @param {Object} rawNode - Raw node data from Neo4j
 * @param {string} direction - Transformation direction ("neo4jToReactFlow" or "reactFlowToNeo4j")
 * @returns {Object} Transformed node data
 */
```

#### API Integration

```typescript
/**
 * @function updateFeatureNode
 * @description Updates a feature node in the backend
 * @param {string} id - Node ID
 * @param {Partial<FeatureNodeData>} data - Data to update
 * @returns {Promise<FeatureNode>} Updated feature node
 */
```

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