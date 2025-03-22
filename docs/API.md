# API Reference

## Overview

The Cerebro API provides endpoints for managing different types of nodes in the system. All endpoints are RESTful and return JSON responses.

## Base URL

```
http://localhost:3000/api/graph
```

## Authentication

All API requests require authentication. Include your authentication token in the request header:

```
Authorization: Bearer your-token-here
```

## Common Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "error": null
}
```

## Node Types

### Option Nodes

#### Create Option Node

```http
POST /option
Content-Type: application/json

{
  "title": "Test Option",
  "description": "A test option with complex data",
  "position": { "x": 100, "y": 200 },
  "optionType": "customer",
  "duration": 30,
  "status": "planning"
}
```

#### Get Option Node

```http
GET /option/{option_id}
```

#### Update Option Node

```http
PATCH /option/{option_id}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "goals": [
    {
      "id": "goal1",
      "name": "Increase Revenue",
      "description": "Increase revenue by 20% in the next quarter"
    }
  ],
  "risks": [
    {
      "id": "risk1",
      "name": "Market Volatility",
      "description": "Market conditions may change rapidly",
      "impact": "high",
      "likelihood": "medium"
    }
  ],
  "memberAllocations": [
    {
      "memberId": "member1",
      "timePercentage": 50
    }
  ]
}
```

#### Delete Option Node

```http
DELETE /option/{option_id}
```

### Provider Nodes

#### Create Provider Node

```http
POST /provider
Content-Type: application/json

{
  "title": "Test Provider",
  "description": "A test provider with complex data",
  "position": { "x": 100, "y": 200 },
  "duration": 30,
  "status": "planning"
}
```

#### Get Provider Node

```http
GET /provider/{provider_id}
```

#### Update Provider Node

```http
PATCH /provider/{provider_id}
Content-Type: application/json

{
  "title": "Updated Provider",
  "description": "Updated description",
  "costs": [
    {
      "id": "cost1",
      "name": "Fixed Cost",
      "costType": "fixed",
      "details": {
        "type": "fixed",
        "amount": 1000,
        "frequency": "monthly"
      }
    }
  ],
  "ddItems": [
    {
      "id": "dd1",
      "name": "Security Review",
      "status": "pending",
      "notes": "Need to complete security review",
      "dueDate": "2023-12-31"
    }
  ],
  "teamAllocations": [
    {
      "teamId": "team1",
      "requestedHours": 40,
      "allocatedMembers": [
        {
          "memberId": "member1",
          "hours": 20
        }
      ]
    }
  ]
}
```

#### Delete Provider Node

```http
DELETE /provider/{provider_id}
```

### Feature Nodes

#### Create Feature Node

```http
POST /feature
Content-Type: application/json

{
  "title": "New Feature",
  "description": "A feature with complex data flow",
  "position": { "x": 100, "y": 200 },
  "buildType": "internal",
  "duration": 21,
  "timeUnit": "days",
  "status": "planning"
}
```

#### Get Feature Node

```http
GET /feature/{feature_id}
```

#### Update Feature Node

```http
PATCH /feature/{feature_id}
Content-Type: application/json

{
  "title": "Updated Feature",
  "description": "Updated description",
  "duration": 30,
  "buildType": "internal",
  "startDate": "2025-01-03",
  "endDate": "2025-04-16",
  "memberAllocations": [
    {
      "memberId": "member1",
      "hours": 20
    }
  ],
  "teamAllocations": [
    {
      "teamId": "team1",
      "requestedHours": 40,
      "allocatedMembers": [
        {
          "memberId": "member1",
          "hours": 20
        }
      ]
    }
  ]
}
```

#### Delete Feature Node

```http
DELETE /feature/{feature_id}
```

#### Feature Node Data Types

```typescript
/**
 * Feature Node Data Structure
 */
interface FeatureNodeData {
  /**
   * The display title of the feature
   */
  title: string;
  
  /**
   * Detailed feature description
   */
  description: string;
  
  /**
   * The build approach (e.g., "internal", "external")
   */
  buildType?: string;
  
  /**
   * The planned duration in time units
   */
  duration: number;
  
  /**
   * Unit of time measurement (e.g., "days", "weeks")
   */
  timeUnit?: string;
  
  /**
   * Current feature status (e.g., "planning", "in-progress")
   */
  status?: string;
  
  /**
   * Planned start date in ISO format
   */
  startDate?: string;
  
  /**
   * Planned end date in ISO format
   */
  endDate?: string;
  
  /**
   * Array of team members assigned to the feature
   */
  teamMembers: TeamMember[];
  
  /**
   * Detailed allocation of team members
   */
  memberAllocations: MemberAllocation[];
  
  /**
   * Allocations at the team level
   */
  teamAllocations: TeamAllocation[];
}

/**
 * Team allocation structure
 */
interface TeamAllocation {
  /**
   * The team identifier
   */
  teamId: string;
  
  /**
   * Requested hours for this team
   */
  requestedHours: number;
  
  /**
   * Specific member allocations within this team
   */
  allocatedMembers: Array<{
    /**
     * The member identifier
     */
    memberId: string;
    
    /**
     * Allocated hours for this member
     */
    hours: number;
  }>;
  
  /**
   * Total team bandwidth capacity
   */
  teamBandwidth: number;
  
  /**
   * Available bandwidth after allocations
   */
  availableBandwidth: number;
  
  /**
   * Display name of the team
   */
  teamName: string;
}

/**
 * Member allocation structure
 */
interface MemberAllocation {
  /**
   * The member identifier
   */
  memberId: string;
  
  /**
   * Hours allocated to this member
   */
  hours: number;
  
  /**
   * Display name of the member
   */
  name: string;
}
```

#### Feature Node API Implementation Notes

The Feature Node API implements several specialized update mechanisms to prevent circular updates and ensure data consistency:

1. **Duration Updates**
   - Duration changes affect start/end dates
   - Changes are debounced to prevent rapid updates
   - Origin tracking prevents circular references

2. **Member Allocation Updates**
   - API handles individual member allocations
   - Team bandwidth is automatically recalculated
   - Resources are checked for availability

3. **Date Updates**
   - Start/end date updates are synchronized
   - Changes may affect dependent nodes
   - Duration may be recalculated based on dates

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

### Common Error Codes

- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Missing or invalid authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Resource conflict
- `500`: Internal Server Error - Server-side error

## Rate Limiting

API requests are limited to:
- 100 requests per minute per IP
- 1000 requests per hour per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1623456789
```

## Best Practices

1. **Error Handling**
   - Always check the `success` field in responses
   - Handle errors appropriately in your application
   - Implement retry logic for transient errors

2. **Rate Limiting**
   - Monitor rate limit headers
   - Implement exponential backoff for retries
   - Cache responses when appropriate

3. **Data Validation**
   - Validate data before sending to the API
   - Handle partial updates carefully
   - Use appropriate data types

4. **Authentication**
   - Store tokens securely
   - Implement token refresh logic
   - Handle authentication errors gracefully

## Node Data Manifest System API

### Core Functions

#### Publishing Updates

```typescript
publishManifestUpdate(
  data: NodeData,           // Updated node data
  changedFields: string[],  // Fields that changed
  metadata?: UpdateMetadata // Optional metadata
)
```

Example:
```typescript
const { publishManifestUpdate } = useNodeObserver<RFTeamMemberNodeData>(id, 'teamMember');

const handleTitleChange = useCallback((title: string) => {
  updateNodeData(id, { ...data, title });
  publishManifestUpdate(
    { ...data, title },
    ['title'],
    { source: 'ui' }
  );
  saveToBackend({ title });
}, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);
```

#### Subscribing to Updates

```typescript
subscribeBasedOnManifest(): {
  refresh: () => void;
  unsubscribe: () => void;
}
```

Example:
```typescript
const { subscribeBasedOnManifest } = useNodeObserver<RFFeatureNodeData>(id, 'feature');

useEffect(() => {
  const { refresh, unsubscribe } = subscribeBasedOnManifest();
  
  const handleNodeDataUpdated = (event: Event) => {
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail;
    
    if (detail.subscriberId !== id) return;
    
    if (detail.publisherType === 'team' && 
        detail.relevantFields.includes('title')) {
      // Handle update
    }
  };
  
  window.addEventListener('nodeDataUpdated', handleNodeDataUpdated);
  
  return () => {
    unsubscribe();
    window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated);
  };
}, [id, subscribeBasedOnManifest]);
```

### Utility Functions

#### Field Management

```typescript
// Get manifest for a node type
getNodeManifest(nodeType: string): NodeManifest

// Check if node publishes a field
doesNodePublish(nodeType: string, fieldId: string): boolean

// Check if node subscribes to another node type
doesNodeSubscribeTo(subscriberType: string, publisherType: string): boolean

// Get fields a node subscribes to
getSubscribedFields(subscriberType: string, publisherType: string): string[]

// Check if field is critical
isFieldCritical(nodeType: string, fieldId: string): boolean

// Get field details
getFieldDetails(nodeType: string, fieldId: string): DataField

// Get subscribers for a field
getSubscribersForField(publisherType: string, fieldId: string): string[]
```

#### Debugging

```typescript
// Debug a node update
debugNodeUpdate(
  publisherType: string,
  publisherId: string,
  affectedFields: string[]
): void
```

Example:
```typescript
import { debugNodeUpdate } from '@/services/graph/observer/node-manifest';

debugNodeUpdate('team', 'team-123', ['title', 'roster']);
```

### Types

```typescript
interface NodeManifest {
  publishes: {
    fields: DataField[];
  };
  subscribes: {
    nodeTypes: string[];
    fields: Record<string, string[]>;
  };
}

interface DataField {
  id: string;
  name: string;
  description: string;
  path: string;
  critical: boolean;
}

interface UpdateMetadata {
  updateType?: NodeUpdateType;
  timestamp?: number;
  affectedFields?: string[];
  nodeType?: string;
  source?: string;
}
```

## Duration Field Handling

The system provides a standardized way to handle duration-related fields to prevent circular updates in the node pub/sub system.

### Core Hook

```typescript
useDurationPublishing<T extends NodeDataWithDuration>(
  nodeId: string,
  nodeType: NodeType,
  nodeData: T,
  publishFn?: (data: T, fields: string[], metadata?: Partial<NodeUpdateMetadata>) => void,
  options?: DurationPublishingOptions
): {
  handleDurationChange: (value: string, originalHandler: (value: string) => void) => void;
  saveToBackend: () => () => void;
  shouldProcessUpdate: (publisherId: string, fields: string[]) => boolean;
  isUpdating: React.MutableRefObject<boolean>;
  isUpdateTooRecent: (field: string, bufferMs?: number) => boolean;
}
```

This hook provides:

1. **Standardized update handling**: Consistent approach to duration field changes
2. **Circular update prevention**: Multiple mechanisms to prevent update loops
3. **Debounced API calls**: Efficient backend updates
4. **Event filtering**: Intelligent processing of incoming updates
5. **Direct API Calls**: Uses direct API calls rather than intermediate functions to avoid trigger chains

### Usage Example

```typescript
// In a node hook like useFeatureNode
const durationPublishing = useDurationPublishing(
  id, 
  'feature', 
  data, 
  publishManifestUpdate,
  { 
    fieldName: 'duration',
    debugName: 'FeatureNode'
  }
);

// Override the duration change handler
const handleDurationChange = useCallback((value: string) => {
  durationPublishing.handleDurationChange(value, originalHandler);
}, [originalHandler, durationPublishing]);

// Save duration to backend when it changes
useEffect(() => {
  return durationPublishing.saveToBackend();
}, [data.duration, durationPublishing]);

// Filter incoming events in event handler
if (!durationPublishing.shouldProcessUpdate(publisherId, relevantFields)) {
  return; // Skip this update to avoid loops
}
```

### Prevention Mechanisms

The hook employs multiple protection layers:

1. **Update Flags**: Tracks when updates are in progress to prevent overlapping changes
2. **Value Comparison**: Skips updates when values aren't actually changing
3. **Timestamp Tracking**: Prevents rapid consecutive updates to the same field
4. **Self-update Detection**: Identifies and skips self-originated updates
5. **Direct API Calls**: Uses direct API calls rather than intermediate functions to avoid trigger chains

### Configuration Options

```typescript
interface DurationPublishingOptions {
  fieldName: string;      // Field name in the node data (default: 'duration')
  updateType?: NodeUpdateType; // Type of update to publish (default: CONTENT)
  debugName?: string;     // Name used in debug logs (default: nodeType + 'Node')
}
```

## Member Allocation Publishing

The system provides a standardized way to handle member allocation updates across all work node types to ensure consistent rendering and prevent circular updates.

### Core Hook

```typescript
useMemberAllocationPublishing<T extends NodeDataWithTeamAllocations>(
  nodeId: string,
  nodeType: NodeType, 
  nodeData: T,
  publishFn?: (data: T, fields: string[], metadata?: Partial<NodeUpdateMetadata>) => void,
  options?: MemberAllocationPublishingOptions
): {
  handleAllocationChange: (teamId: string, memberId: string, hours: number, originalHandler: (teamId: string, memberId: string, hours: number) => void) => void;
  handleAllocationCommit: (teamId: string, memberId: string, hours: number, originalHandler: (teamId: string, memberId: string, hours: number) => void) => void;
  saveToBackend: (teamAllocations: TeamAllocation[]) => () => void;
  shouldProcessUpdate: (publisherId: string, fields: string[]) => boolean;
  isUpdating: React.MutableRefObject<boolean>;
  isUpdateTooRecent: (field: string, bufferMs?: number) => boolean;
}
```

This hook provides:

1. **Standardized allocation handling**: Consistent approach to member allocation updates
2. **Circular update prevention**: Multiple mechanisms to prevent update loops
3. **Debounced API calls**: Efficient backend updates
4. **Event filtering**: Intelligent processing of incoming updates
5. **Proper rendering**: Ensures allocation values render correctly

### Usage Example

```typescript
// In a node hook like useFeatureNode
const allocationPublishing = useMemberAllocationPublishing(
  id, 
  'feature', 
  data, 
  publishManifestUpdate,
  { 
    fieldName: 'teamAllocations',
    debugName: 'FeatureNode'
  }
);

// Override the allocation change handler
const handleAllocationChange = useCallback((teamId: string, memberId: string, hours: number) => {
  allocationPublishing.handleAllocationChange(teamId, memberId, hours, originalHandleAllocationChange);
}, [originalHandleAllocationChange, allocationPublishing]);

// Override the allocation commit handler
const handleAllocationCommit = useCallback((teamId: string, memberId: string, hours: number) => {
  allocationPublishing.handleAllocationCommit(teamId, memberId, hours, originalHandleAllocationCommit);
}, [originalHandleAllocationCommit, allocationPublishing]);

// Save allocations to backend when they change
useEffect(() => {
  if (data.teamAllocations?.length > 0) {
    return allocationPublishing.saveToBackend(data.teamAllocations);
  }
}, [data.teamAllocations, allocationPublishing]);

// Filter incoming events in event handler
if (!allocationPublishing.shouldProcessUpdate(publisherId, relevantFields)) {
  return; // Skip this update to avoid loops
}
```

### Prevention Mechanisms

The hook employs multiple protection layers similar to the duration publishing hook:

1. **Update Flags**: Tracks when updates are in progress
2. **Timestamp Tracking**: Prevents rapid consecutive updates
3. **Self-update Detection**: Identifies and skips self-originated updates
4. **Value Comparison**: Skips updates when allocation values aren't changing

### Configuration Options

```typescript
interface MemberAllocationPublishingOptions {
  fieldName: string;      // Field name in the node data (default: 'teamAllocations')
  updateType?: NodeUpdateType; // Type of update to publish (default: CONTENT)
  debugName?: string;     // Name used in debug logs (default: nodeType + 'Node')
}
```

## Edge Operations

### Milestone Edges

#### Get Milestone Edge by ID

```http
GET /graph/milestone/edges/{id}
```

Retrieves a specific milestone edge by its ID.

**Response**

```json
{
  "id": "string",
  "source": "string",
  "target": "string",
  "type": "dependency|related|string",
  "data": {
    "label": "string",
    "edgeType": "string"
  }
}
```

#### Update Milestone Edge

```http
PATCH /graph/milestone/edges/{id}
Content-Type: application/json

{
  "data": {
    "label": "string",
    "edgeType": "string"
  }
}
```

Updates an existing milestone edge.

**Response**

```json
{
  "id": "string",
  "source": "string",
  "target": "string",
  "type": "dependency|related|string",
  "data": {
    "label": "string",
    "edgeType": "string"
  }
}
```

#### Delete Milestone Edge

```http
DELETE /graph/milestone/edges/{id}
```

Deletes a milestone edge.

**Response**

```json
{
  "success": true
}
```

### Provider Edges

#### Get All Provider Edges

```http
GET /graph/provider/{id}/edge?type={edgeType}
```

Retrieves all edges connected to a provider. Optionally filter by edge type.

**Response**

```json
[
  {
    "id": "string",
    "source": "string",
    "target": "string",
    "type": "PROVIDER_TEAM|PROVIDER_FEATURE|PROVIDER_DEPENDENCY|string",
    "data": {
      "label": "string",
      "edgeType": "string",
      "allocation": 0
    }
  }
]
```

#### Create Provider Edge

```http
POST /graph/provider/{id}/edge
Content-Type: application/json

{
  "target": "string",
  "type": "PROVIDER_TEAM|PROVIDER_FEATURE|PROVIDER_DEPENDENCY|string",
  "data": {
    "label": "string",
    "allocation": 0
  }
}
```

Creates a new edge connected to a provider.

**Response**

```json
{
  "id": "string",
  "source": "string",
  "target": "string",
  "type": "PROVIDER_TEAM|PROVIDER_FEATURE|PROVIDER_DEPENDENCY|string",
  "data": {
    "label": "string",
    "edgeType": "string",
    "allocation": 0
  }
}
```

#### Get Provider Edge by ID

```http
GET /graph/provider/edge/{id}
```

Retrieves a specific provider edge by its ID.

**Response**

```json
{
  "id": "string",
  "source": "string",
  "target": "string",
  "type": "PROVIDER_TEAM|PROVIDER_FEATURE|PROVIDER_DEPENDENCY|string",
  "data": {
    "label": "string",
    "edgeType": "string",
    "allocation": 0
  }
}
```

#### Update Provider Edge

```http
PATCH /graph/provider/edge/{id}
Content-Type: application/json

{
  "label": "string",
  "allocation": 0
}
```

Updates an existing provider edge.

**Response**

```json
{
  "id": "string",
  "source": "string",
  "target": "string",
  "type": "PROVIDER_TEAM|PROVIDER_FEATURE|PROVIDER_DEPENDENCY|string",
  "data": {
    "label": "string",
    "edgeType": "string",
    "allocation": 0
  }
}
```

#### Delete Provider Edge

```http
DELETE /graph/provider/edge/{id}
```

Deletes a provider edge.

**Response**

```json
{
  "success": true
}
``` 