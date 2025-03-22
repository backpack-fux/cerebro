# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation for Feature Node data flow in ARCHITECTURE.md and API.md
- JSDoc documentation for Feature Node data structures and publishing mechanisms
- Detailed type definitions for Feature Node data structures
- Implementation notes for preventing circular updates in Feature Node
- Standardized duration handling across all node types with `useDurationPublishing` hook
- Multiple protection mechanisms to prevent circular updates
- Consistent API for duration field updates
- Improved debug logging for update tracking
- Standardized member allocation handling with new `useMemberAllocationPublishing` hook
- Protection against circular updates in member allocation flows

### Changed
- Refactored feature, provider, and option nodes to use standardized duration handling
- Updated API documentation with duration handling best practices
- Enhanced event filtering to avoid update loops
- Unified member allocation implementation across all work node types
- Improved allocation slider behavior and value rendering

### Fixed
- Resolved circular update loops in feature nodes
- Fixed inconsistent duration update handling between node types
- Eliminated redundant API calls and updates
- Fixed member allocation values not rendering correctly in work nodes
- Resolved allocation data synchronization issues
- Date persistence issue in Feature Node UI
- Member allocation rendering issues across node types
- Standardized member allocation publishing patterns

## [0.1.0] - 2023-03-19

### Added
- Edge deduplication utility accessed through a "Fix Duplicate Edges" button in the console panel
- Improved edge transformation between Neo4j and React Flow formats
- Better filtering of invalid edges during graph loading

### Fixed
- Implemented utility endpoint to clean up existing duplicate edges
- Added edge filtering to ensure both source and target nodes exist

### Technical Improvements
- Enhanced typings for edge-related operations
- Improved error handling in edge operations
- Added comprehensive logging for edge transformations
- Deduplication of edges based on source-target pairs 