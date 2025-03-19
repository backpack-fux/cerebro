# Changelog

This document tracks significant changes, bug fixes, and feature additions to the Cerebro project.

## [Unreleased]

## [0.1.0] - 2025-03-19

### Added
- Edge deduplication utility accessed through a "Fix Duplicate Edges" button in the console panel
- Improved edge transformation between Neo4j and React Flow formats
- Better filtering of invalid edges during graph loading

### Fixed
- Edge persistence issue on page refresh
  - Edges now properly persist between sessions and appear correctly after page reload
  - Fixed source/target vs from/to property mismatch between Neo4j and React Flow
  - Added proper edge transformation in the graph loading process
- Duplicate edge creation issue
  - Added deduplication logic in the graph API endpoint
  - Implemented utility endpoint to clean up existing duplicate edges
  - Added edge filtering to ensure both source and target nodes exist

### Technical Improvements
- Enhanced typings for edge-related operations
- Improved error handling in edge operations
- Added comprehensive logging for edge transformations
- Deduplication of edges based on source-target pairs 