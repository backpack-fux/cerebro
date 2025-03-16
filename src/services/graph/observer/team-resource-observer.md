# Team Resource Observer Pattern

## Problem Statement

In our application, we have multiple types of work nodes (feature, option, provider) that need to allocate resources from teams. Each work node needs to know:

1. How many hours are available for each team member
2. How many hours have already been allocated to other work nodes
3. When team resources change (e.g., a team member's allocation changes)

Previously, each node type calculated resource availability independently, leading to inconsistencies and potential over-allocation of resources.

## Solution

We've implemented an observer pattern for team resources that:

1. Centralizes resource allocation logic in a single place
2. Provides a single source of truth for team resource availability
3. Handles resource contention between different work nodes
4. Ensures consistent calculation of available hours

## Usage

### Initializing Team Resources

When a team is created or updated, its resources need to be initialized in the observer:

```typescript
import { initializeTeamResources } from '@/services/graph/team/team-resource-integration';

// Initialize team resources
initializeTeamResources(teamNode);
```

### Subscribing to Team Resource Updates

Work nodes need to subscribe to team resource updates when they connect to a team:

```typescript
import { connectFeatureToTeam } from '@/services/graph/feature/feature-resource-integration';

// Connect to team resources
connectFeatureToTeam(
  featureNode,
  teamId,
  (data) => {
    // Handle resource updates
    handleTeamResourceUpdate(featureId, teamId, data);
  }
);
```

### Requesting Resource Allocation

When a work node needs to allocate resources, it requests them from the observer:

```typescript
import { updateFeatureResourceAllocation } from '@/services/graph/feature/feature-resource-integration';

// Update resource allocation
updateFeatureResourceAllocation(
  featureId,
  teamId,
  memberAllocations,
  projectDurationDays
);
```

### Getting Available Hours

To get available hours for a team member, work nodes use the observer:

```typescript
import { getFeatureMemberAvailableHours } from '@/services/graph/feature/feature-resource-integration';

// Get available hours for a member
const availableHours = getFeatureMemberAvailableHours(
  featureId,
  teamId,
  memberId,
  memberData,
  projectDurationDays
);
```

### Releasing Resources

When a work node is disconnected from a team, it releases its allocated resources:

```typescript
import { disconnectFeatureFromTeam } from '@/services/graph/feature/feature-resource-integration';

// Disconnect from team resources
disconnectFeatureFromTeam(featureId, teamId);
```

## Integration with Node Types

### Team Service

The team service initializes team resources and publishes updates when team data changes:

```typescript
// In team.service.ts
import { initializeTeamResources, setupTeamResourcePublishing, updateTeamRoster } from './team-resource-integration';

// When creating a team
initializeTeamResources(teamNode);
setupTeamResourcePublishing(teamId);

// When updating a team
initializeTeamResources(updatedTeamNode);

// When updating a team's roster
updateTeamRoster(teamId, roster);
```

### Feature Service

The feature service connects to team resources and handles resource updates:

```typescript
// In feature.service.ts
import { connectFeatureToTeam, disconnectFeatureFromTeam, updateFeatureResourceAllocation } from './feature-resource-integration';

// When adding a team to a feature
connectFeatureToTeam(featureNode, teamId, handleTeamResourceUpdate);

// When updating team allocation
updateFeatureResourceAllocation(featureId, teamId, memberAllocations, projectDurationDays);

// When removing a team from a feature
disconnectFeatureFromTeam(featureId, teamId);
```

### Option Service

The option service connects to team resources and handles resource updates:

```typescript
// In option.service.ts
import { connectOptionToTeam, disconnectOptionFromTeam, updateOptionResourceAllocation } from './option-resource-integration';

// When adding a team to an option
connectOptionToTeam(optionNode, teamId, handleTeamResourceUpdate);

// When updating team allocation
updateOptionResourceAllocation(optionId, teamId, memberAllocations, projectDurationDays);

// When removing a team from an option
disconnectOptionFromTeam(optionId, teamId);
```

## Benefits

1. **Consistency**: All work nodes show the same available hours for team members
2. **Resource Contention**: The system properly handles multiple nodes competing for resources
3. **Single Source of Truth**: No more data inconsistencies between different node types
4. **Simplified Maintenance**: Centralized logic makes future changes easier

## Implementation Details

### Team Resource Observer

The `TeamResourceObserver` class is the core of the implementation. It:

1. Tracks team resources and allocations
2. Handles resource allocation requests
3. Publishes resource updates to subscribers
4. Calculates available hours for team members

### Node Observer Integration

The team resource observer is built on top of the existing `NodeObserver` system, using the `NodeUpdateType.ALLOCATION` event type for resource allocation updates.

### Shared Utilities

The `calculateNodeMemberCapacity` utility function ensures consistent capacity calculations across all node types.

## Future Improvements

1. **Conflict Resolution**: Add UI for resolving resource allocation conflicts
2. **Resource Visualization**: Add visualization of resource usage across work nodes
3. **Allocation Priorities**: Add priority levels for different types of work nodes
4. **Historical Tracking**: Track resource allocation changes over time 