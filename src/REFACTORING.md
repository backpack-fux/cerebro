# Refactoring: Separating React Flow Component State from Domain Logic

## Overview

This refactoring aims to separate React Flow component state from our domain logic to improve maintainability, testability, and reusability of our codebase. The approach follows a clear separation of concerns:

1. **React Flow Components**: Handle UI rendering, user interactions, and React Flow-specific state
2. **Domain Hooks**: Encapsulate business logic, data transformations, and backend interactions
3. **Shared Types**: Define common interfaces used across components and hooks

## Refactoring Strategy

### Components

- [x] Feature Node
- [x] Provider Node
- [x] Option Node
- [x] Team Node
- [x] Team Member Node
- [x] Milestone Node
- [x] Meta Node

### Architecture

1. **React Flow Components**: These components will focus solely on rendering the UI and handling React Flow-specific interactions.
2. **Domain Hooks**: These hooks will encapsulate all the domain logic, including state management, validation, and backend interactions.
3. **Shared Types**: These types will be used across both the React Flow components and domain hooks to ensure type safety.

### Next Steps

1. Refactor remaining node types
2. Refactor shared hooks for better reusability
3. Add unit tests for hooks
4. Performance profiling to measure impact of refactoring

## Feature Node

The Feature Node has been refactored to use the new `useFeatureNode` hook. This hook encapsulates all the domain logic for the Feature Node, including:

- Managing feature data (title, description, etc.)
- Handling connections to team nodes
- Calculating bandwidth and progress
- Saving data to the backend

Key improvements:
- Separation of concerns: UI rendering is now separate from business logic
- Better performance through memoization
- Improved error handling
- More maintainable code structure

## Provider Node

The Provider Node has been refactored to use the new `useProviderNode` hook. This hook encapsulates all the domain logic for the Provider Node, including:

- Managing provider data (title, description, etc.)
- Handling connections to feature nodes
- Calculating costs and allocations
- Saving data to the backend

Key improvements:
- Separation of concerns: UI rendering is now separate from business logic
- Better performance through memoization
- Improved error handling
- More maintainable code structure

## Option Node

The Option Node has been refactored to use the new `useOptionNode` hook. This hook encapsulates all the domain logic for the Option Node, including:

- Managing option data (title, description, goals, risks, etc.)
- Handling team allocations
- Calculating costs and expected values
- Saving data to the backend

Key improvements:
- Separation of concerns: UI rendering is now separate from business logic
- Better performance through memoization
- Improved error handling
- More maintainable code structure

## Team Node

The Team Node has been refactored to use the new `useTeamNode` hook. This hook encapsulates all the domain logic for the Team Node, including:

- Managing team data (title, description, season, etc.)
- Handling team roster and member allocations
- Calculating bandwidth and season progress
- Saving data to the backend

Key improvements:
- Separation of concerns: UI rendering is now separate from business logic
- Better performance through memoization
- Improved error handling
- More maintainable code structure

## Team Member Node

The Team Member Node has been refactored to use the new `useTeamMemberNode` hook. This hook encapsulates all the domain logic for the Team Member Node, including:

- Managing team member data (title, bio, roles, timezone, etc.)
- Handling capacity calculations (hours per day, days per week, weekly capacity)
- Managing team allocations and connections
- Validating inputs and saving data to the backend

Key improvements:
- Separation of concerns: UI rendering is now separate from business logic
- Better performance through memoization
- Enhanced validation with clear error messages
- Improved synchronization between team member and team nodes
- More maintainable code structure with clear organization of data, validation, and actions

## Milestone Node

The Milestone Node has been refactored to use the new `useMilestoneNode` hook. This hook encapsulates all the domain logic for the Milestone Node, including:

- Managing milestone data (title, description, status)
- Handling automatic status updates based on connected nodes
- Calculating metrics (total cost, monthly value, completion status)
- Saving data to the backend with proper debouncing

Key improvements:
- Separation of concerns: UI rendering is now separate from business logic
- Better performance through memoization
- Improved status management with automatic updates based on connected nodes
- Enhanced metrics calculation and display
- More maintainable code structure with clear organization of data and actions

## Meta Node

The Meta Node has been refactored to follow the same pattern as the other node components:

1. Created the `useMetaNode` hook:
   - Encapsulated domain logic for managing meta node data
   - Implemented debounced saving for title and description changes
   - Added edge management functionality
   - Optimized performance with memoization

2. Refactored the `MetaNode` component:
   - Simplified to focus on UI rendering
   - Removed business logic and state management
   - Used the hook for data and actions
   - Added memoization with React.memo

### Key Improvements

- **Separation of Concerns**: Clear separation between UI rendering and business logic
- **Performance**: Optimized rendering with memoization and debounced API calls
- **Maintainability**: Simplified component structure makes it easier to understand and modify
- **Consistency**: Follows the same pattern as other node components

## Benefits

1. **Improved Testability**: Domain logic can be tested independently of React components
2. **Better Reusability**: Logic can be shared across different views or components
3. **Cleaner Components**: Components focus only on rendering, not business logic
4. **Easier Maintenance**: Changes to business logic don't require component changes
5. **Type Safety**: Better type definitions across the application
6. **Performance Optimization**: Consistent memoization strategy prevents unnecessary re-renders

## Completed Refactorings

### Provider Node Refactoring (Completed)

The Provider Node refactoring involved:

1. Creating a `useProviderNode` hook that encapsulates all provider-specific logic:
   - Data validation and transformation for costs, due diligence items, and team allocations
   - Backend interactions with proper debouncing
   - Status management and team allocation handling
   - Cost calculations and summaries

2. Simplifying the `ProviderNode` component:
   - Removed all business logic and state management
   - Focused purely on rendering the UI based on data from the hook
   - Added proper memoization with React.memo
   - Improved component structure and readability

3. Key improvements:
   - Fixed issues with data structure validation
   - Improved error handling for malformed data
   - Enhanced performance through consistent memoization
   - Better separation of concerns between UI and business logic 

### Option Node (Completed)

The Option Node refactoring involved:

1. Creating a `useOptionNode` hook that encapsulates all option-specific logic:
   - Manages option goals, risks, and financial calculations
   - Handles data transformations and backend interactions
   - Returns data and actions needed by the component
   - Implements proper debouncing for backend operations
   - Provides consistent data structure validation and normalization

2. Simplifying the `OptionNode` component:
   - Removed all business logic and state management
   - Focused purely on rendering the UI based on data from the hook
   - Added proper memoization with React.memo
   - Improved component structure and readability

3. Key improvements:
   - Enhanced financial calculations (transaction fees, payoff estimates)
   - Improved handling of goals, risks, and team allocations
   - Added proper memoization for performance optimization
   - Better separation of concerns between UI and business logic
   - Simplified team allocation management with percentage-based controls
   - Improved payoff calculation with days/months/years formatting
   - Enhanced type safety with proper TypeScript typing 

### Team Node (Completed)

The Team Node refactoring involved:

1. Creating a `useTeamNode` hook that encapsulates all team-specific logic:
   - Manages team roster, season data, and bandwidth calculations
   - Handles team member connections and allocations
   - Provides data validation and transformation
   - Implements debounced backend saving functionality
   - Returns memoized data and actions for the component

2. Simplifying the `TeamNode` component:
   - Removed all business logic and state management
   - Focused purely on rendering the UI based on data from the hook
   - Added proper memoization with React.memo
   - Improved component structure and readability

3. Key improvements:
   - Enhanced roster management with proper validation
   - Improved season progress calculations
   - Optimized bandwidth calculations
   - Added proper memoization for performance optimization
   - Better separation of concerns between UI and business logic 