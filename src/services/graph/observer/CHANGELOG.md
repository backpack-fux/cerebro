# Node Data Manifest System Changelog

## [1.3.0] - 2023-03-17

### Added
- New manifest files for additional node types:
  - `src/services/graph/milestone/milestone.manifest.ts`
  - `src/services/graph/meta/meta.manifest.ts`
- Extended field definitions for milestone nodes:
  - KPIs with targets and units
  - Feature allocations with hours and costs
  - Option revenue details
  - Provider cost details
- Extended field definitions for meta nodes:
  - Knowledge and roadmap metadata
  - Tags with names and colors
  - Related links with URLs and descriptions
- Updated cross-node subscriptions:
  - Milestone nodes now subscribe to feature, option, provider, and team nodes
  - Meta nodes now subscribe to all other node types
- Updated documentation to include new node types

### Changed
- Updated the main manifest file to import and include the new manifests
- Enhanced README with information about the new supported node types

## [1.2.0] - 2023-03-16

### Added
- New manifest files for additional node types:
  - `src/services/graph/option/option.manifest.ts`
  - `src/services/graph/provider/provider.manifest.ts`
- Extended field definitions for option nodes:
  - Goals and risks with impact and severity levels
  - Team and member allocations
  - Option type and duration fields
- Extended field definitions for provider nodes:
  - Cost structures (fixed, unit, revenue, tiered)
  - Due diligence items with status tracking
  - Team allocations with requested hours
- Updated cross-node subscriptions:
  - Option nodes now subscribe to team, team member, feature, and provider nodes
  - Provider nodes now subscribe to team, team member, and feature nodes
- Updated documentation to include new node types

### Changed
- Updated the main manifest file to import and include the new manifests
- Enhanced README with information about the new supported node types

## [1.1.0] - 2023-03-15

### Added
- Individual manifest files for each node type:
  - `src/services/graph/team-member/team-member.manifest.ts`
  - `src/services/graph/team/team.manifest.ts`
  - `src/services/graph/feature/feature.manifest.ts`
- Base manifest file with common fields and utilities:
  - `src/services/graph/base-node/base-manifest.ts`
- Helper functions for creating data fields:
  - `createField`
  - `createNestedField`
  - `createArrayItemField`
- Comprehensive documentation:
  - `src/services/graph/observer/README.md`

### Changed
- Restructured the manifest system to be more modular and maintainable
- Updated the main manifest file to import and combine individual manifests
- Added more detailed field definitions for each node type
- Improved type safety with better TypeScript typing

### Benefits
- **Modularity**: Each node type has its own manifest file, making it easier to maintain and extend
- **Discoverability**: Manifest files are located in the same directory as the node type they describe
- **Consistency**: Common fields and utilities are defined in a single place
- **Documentation**: Comprehensive documentation makes it easier for developers to understand and use the system
- **Extensibility**: Adding a new node type is now a well-defined process

## [1.0.0] - 2023-03-14

### Added
- Initial implementation of the Node Data Manifest System
- Main manifest file with field definitions for all node types
- Node observer implementation for publish-subscribe pattern
- Utility functions for working with manifests
- Visualization component for exploring node relationships 