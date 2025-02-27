// src/services/graph/shared/shared.types.ts

// Common types shared across multiple components

/**
 * Role type for team members
 * Represents a role that a team member can have within a team
 */
export type Role = string;

/**
 * Base roles that are available by default
 */
export const BASE_ROLES = [
  'Developer',
  'Designer',
  'Product Manager',
  'Project Manager',
  'QA Engineer',
  'DevOps Engineer',
  'Technical Writer',
  'UX Researcher'
] as const;