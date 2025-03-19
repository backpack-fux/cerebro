# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Docker (for Neo4j database)
- Git
- VS Code (recommended)

### Development Environment Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/cerebro.git
   cd cerebro
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Start Neo4j**
   ```bash
   docker-compose up -d
   ```

4. **Start Development Server**
   ```bash
   bun dev
   ```

5. **Open in VS Code**
   ```bash
   code .
   ```

### VS Code Extensions

Recommended extensions for development:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- GitLens
- Docker

## Project Structure

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

## Development Guidelines

### Code Style

1. **TypeScript**
   - Use strict mode
   - Define explicit return types
   - Use interfaces for object shapes
   - Avoid `any` type

2. **React Components**
   - Use functional components
   - Implement proper prop types
   - Use hooks for state management
   - Memoize expensive computations

3. **File Organization**
   - One component per file
   - Group related components in directories
   - Use index files for exports
   - Keep files under 300 lines

### Adding a New Node Type

1. **Create Manifest File**
   ```typescript
   // src/services/graph/[node-type]/[node-type].manifest.ts
   import { NodeType } from '@/services/graph/neo4j/api-urls';
   import { DataField } from '@/services/graph/observer/node-manifest';
   import { CommonFields } from '@/services/graph/base-node/base-manifest';

   export const NodeTypeFields: Record<string, DataField> = {
     // Define fields
   };

   export const NodeTypeManifest = {
     publishes: {
       fields: [
         CommonFields.TITLE,
         CommonFields.DESCRIPTION,
         // Add node-specific fields
       ]
     },
     subscribes: {
       nodeTypes: ['otherNode'] as NodeType[],
       fields: {
         otherNode: ['field1', 'field2']
       }
     }
   };
   ```

2. **Create Service**
   ```typescript
   // src/services/graph/[node-type]/[node-type].service.ts
   export class NodeTypeService {
     // Implement CRUD operations
   }
   ```

3. **Create Hook**
   ```typescript
   // src/hooks/use[node-type]Node.ts
   export function useNodeTypeNode(id: string) {
     // Implement node logic
   }
   ```

4. **Create Component**
   ```typescript
   // src/components/[node-type]Node.tsx
   export function NodeTypeNode({ id }: { id: string }) {
     // Implement UI
   }
   ```

### Testing

1. **Unit Tests**
   ```typescript
   // src/services/graph/[node-type]/__tests__/[node-type].service.test.ts
   describe('NodeTypeService', () => {
     // Test service methods
   });
   ```

2. **Component Tests**
   ```typescript
   // src/components/__tests__/[node-type]Node.test.tsx
   describe('NodeTypeNode', () => {
     // Test component rendering and interactions
   });
   ```

3. **Integration Tests**
   ```typescript
   // src/tests/integration/[node-type].test.ts
   describe('NodeType Integration', () => {
     // Test node interactions
   });
   ```

### Performance Optimization

1. **React Components**
   - Use `React.memo` for pure components
   - Implement proper dependency arrays in hooks
   - Avoid unnecessary re-renders
   - Use `useCallback` for event handlers

2. **Data Management**
   - Implement proper caching
   - Use pagination for large datasets
   - Optimize graph queries
   - Debounce API calls

3. **Build Optimization**
   - Use dynamic imports
   - Implement code splitting
   - Optimize bundle size
   - Use proper tree shaking

### Edge Handling

1. **Edge Persistence**
   - Edges are stored in Neo4j with `from/to` properties
   - React Flow uses `source/target` properties
   - The API transforms between these formats
   - Edges are properly persisted between sessions

2. **Edge Deduplication**
   - The graph API automatically deduplicates edges based on source-target pairs
   - A utility endpoint `/api/graph/dedupe-edges` can clean up existing duplicate edges
   - The console includes a "Fix Duplicate Edges" button for manual cleanup
   - Edge filtering ensures both source and target nodes exist

3. **Edge Types**
   - Default edges use the `default` type in React Flow
   - Custom edge types can be specified based on connected node types
   - Edge metadata is stored in the `data` property

4. **Edge Creation Rules**
   - Team-Member to Team edges have special allocation properties
   - Different node combinations create different edge types
   - Only create edges between existing nodes
   - Properly cleanup edges when nodes are deleted

### Debugging

1. **React DevTools**
   - Use React DevTools for component inspection
   - Monitor state changes
   - Profile component performance

2. **Browser DevTools**
   - Use Network tab for API calls
   - Use Console for logging
   - Use Performance tab for profiling

3. **VS Code Debugging**
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Debug Tests",
         "program": "${workspaceFolder}/node_modules/bun/bin/bun",
         "args": ["test"]
       }
     ]
   }
   ```

### Git Workflow

1. **Branch Naming**
   - feature/feature-name
   - bugfix/bug-description
   - hotfix/issue-description

2. **Commit Messages**
   ```
   type(scope): description

   [optional body]

   [optional footer]
   ```

3. **Pull Requests**
   - Create feature branches
   - Keep PRs focused and small
   - Include tests
   - Update documentation

## Common Issues

### Neo4j Connection

If Neo4j connection fails:
1. Check if Docker is running
2. Verify Neo4j container is up
3. Check credentials in .env
4. Verify ports are correct

### Build Issues

If build fails:
1. Clear node_modules and reinstall
2. Check TypeScript errors
3. Verify all dependencies
4. Check for circular dependencies

### Performance Issues

If experiencing performance issues:
1. Check React DevTools for re-renders
2. Profile with Chrome DevTools
3. Verify memoization
4. Check API response times

## Working with the Node Data Manifest System

### Adding a New Field

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

### Best Practices

1. **Field Definitions**
   - Use clear, descriptive field names
   - Set `critical: true` only for fields that need immediate updates
   - Include helpful descriptions for documentation

2. **Manifest Structure**
   - Keep manifests focused and minimal
   - Only subscribe to fields you actually need
   - Use common fields when possible

3. **Update Handling**
   - Always include metadata with updates
   - Handle cleanup in useEffect return functions
   - Use type-safe event handling

4. **Debugging**
   - Use `debugNodeUpdate` for troubleshooting
   - Check the Node Manifest Visualizer for relationships
   - Monitor the browser console for update events

### Common Pitfalls

1. **Memory Leaks**
   - Always unsubscribe in useEffect cleanup
   - Remove event listeners properly
   - Clean up subscriptions when components unmount

2. **Update Loops**
   - Be careful with critical fields
   - Avoid circular dependencies
   - Use appropriate update debouncing

3. **Type Safety**
   - Always use TypeScript generics with useNodeObserver
   - Validate field paths match data structure
   - Check manifest types match node data types

### Testing

1. **Unit Tests**
   - Test field definitions
   - Verify manifest structure
   - Check update handling

2. **Integration Tests**
   - Test update propagation
   - Verify subscription cleanup
   - Check resource management

3. **Visualization Tests**
   - Verify node relationships
   - Check field visibility
   - Test interaction handling 