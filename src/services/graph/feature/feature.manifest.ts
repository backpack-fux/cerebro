/**
 * Feature Node Manifest
 * 
 * This file defines what data the feature node type can publish and subscribe to.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createArrayItemField } from '@/services/graph/base-node/base-manifest';

// Feature specific fields
export const FeatureFields: Record<string, DataField> = {
  BUILD_TYPE: {
    id: 'buildType',
    name: 'Build Type',
    description: 'Whether this feature is built internally or externally',
    path: 'buildType',
    critical: true
  },
  COST: {
    id: 'cost',
    name: 'Cost',
    description: 'The calculated cost for this feature',
    path: 'cost'
  },
  DURATION: {
    id: 'duration',
    name: 'Duration',
    description: 'How long this feature will take to build',
    path: 'duration',
    critical: true
  },
  TIME_UNIT: {
    id: 'timeUnit',
    name: 'Time Unit',
    description: 'The unit of time used for duration (days, weeks, etc.)',
    path: 'timeUnit'
  },
  START_DATE: {
    id: 'startDate',
    name: 'Start Date',
    description: 'When this feature is scheduled to start',
    path: 'startDate'
  },
  END_DATE: {
    id: 'endDate',
    name: 'End Date',
    description: 'When this feature is scheduled to end',
    path: 'endDate'
  },
  TEAM_MEMBERS: {
    id: 'teamMembers',
    name: 'Team Members',
    description: 'The team members assigned to this feature',
    path: 'teamMembers'
  },
  MEMBER_ALLOCATIONS: {
    id: 'memberAllocations',
    name: 'Member Allocations',
    description: 'The allocation of team members to this feature',
    path: 'memberAllocations'
  },
  TEAM_ALLOCATIONS: {
    id: 'teamAllocations',
    name: 'Team Allocations',
    description: 'The teams and members allocated to this feature',
    path: 'teamAllocations',
    critical: true
  },
  AVAILABLE_BANDWIDTH: {
    id: 'availableBandwidth',
    name: 'Available Bandwidth',
    description: 'The available bandwidth for this feature',
    path: 'availableBandwidth'
  },
  // Nested fields for team allocations
  TEAM_ALLOCATION_TEAM_ID: createArrayItemField('teamAllocations', 'teamId', 'Team ID', 'The ID of a team allocated to this feature'),
  TEAM_ALLOCATION_REQUESTED_HOURS: createArrayItemField('teamAllocations', 'requestedHours', 'Requested Hours', 'The number of hours requested from a team', true),
  TEAM_ALLOCATION_MEMBERS: createArrayItemField('teamAllocations', 'allocatedMembers', 'Allocated Members', 'The members allocated from a team', true),
  // Nested fields for member allocations
  MEMBER_ALLOCATION_MEMBER_ID: createArrayItemField('memberAllocations', 'memberId', 'Member ID', 'The ID of a member allocated to this feature'),
  MEMBER_ALLOCATION_TIME_PERCENTAGE: createArrayItemField('memberAllocations', 'timePercentage', 'Time Percentage', 'The percentage of time a member is allocated to this feature', true)
};

// Define what the feature node publishes
export const FeaturePublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    CommonFields.POSITION,
    CommonFields.STATUS,
    CommonFields.CREATED_AT,
    CommonFields.UPDATED_AT,
    FeatureFields.BUILD_TYPE,
    FeatureFields.COST,
    FeatureFields.DURATION,
    FeatureFields.TIME_UNIT,
    FeatureFields.START_DATE,
    FeatureFields.END_DATE,
    FeatureFields.TEAM_MEMBERS,
    FeatureFields.MEMBER_ALLOCATIONS,
    FeatureFields.TEAM_ALLOCATIONS,
    FeatureFields.AVAILABLE_BANDWIDTH,
    FeatureFields.TEAM_ALLOCATION_TEAM_ID,
    FeatureFields.TEAM_ALLOCATION_REQUESTED_HOURS,
    FeatureFields.TEAM_ALLOCATION_MEMBERS,
    FeatureFields.MEMBER_ALLOCATION_MEMBER_ID,
    FeatureFields.MEMBER_ALLOCATION_TIME_PERCENTAGE
  ]
};

// Define what the feature node subscribes to
export const FeatureSubscribes = {
  nodeTypes: ['team', 'teamMember'] as NodeType[],
  fields: {
    team: ['title', 'roster', 'bandwidth'],
    teamMember: ['title', 'weeklyCapacity', 'dailyRate']
  }
};

// Export the complete manifest
export const FeatureManifest = {
  publishes: FeaturePublishes,
  subscribes: FeatureSubscribes
}; 