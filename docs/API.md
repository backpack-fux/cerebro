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
  source?: string;
  timestamp?: number;
  userId?: string;
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