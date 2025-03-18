/**
 * Team Node Manifest
 * 
 * This file defines what data the team node type can publish and subscribe to.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createNestedField, createArrayItemField } from '@/services/graph/base-node/base-manifest';

// Team specific fields
export const TeamFields: Record<string, DataField> = {
  ROSTER: {
    id: 'roster',
    name: 'Roster',
    description: 'The team members assigned to this team',
    path: 'roster',
    critical: true
  },
  BANDWIDTH: {
    id: 'bandwidth',
    name: 'Bandwidth',
    description: 'The total and available bandwidth of the team',
    path: 'bandwidth',
    critical: true
  },
  SEASON: {
    id: 'season',
    name: 'Season',
    description: 'The season timeframe for this team',
    path: 'season'
  },
  SEASON_START_DATE: createNestedField('season', 'startDate', 'Season Start Date', 'The start date of the team season'),
  SEASON_END_DATE: createNestedField('season', 'endDate', 'Season End Date', 'The end date of the team season'),
  SEASON_NAME: createNestedField('season', 'name', 'Season Name', 'The name of the team season'),
  SEASON_GOALS: createNestedField('season', 'goals', 'Season Goals', 'The goals for the team season'),
  ROSTER_MEMBER_ID: createArrayItemField('roster', 'memberId', 'Roster Member ID', 'The ID of a team member in the roster'),
  ROSTER_ALLOCATION: createArrayItemField('roster', 'allocation', 'Roster Member Allocation', 'The allocation percentage of a team member in the roster', true),
  ROSTER_ROLE: createArrayItemField('roster', 'role', 'Roster Member Role', 'The role of a team member in the roster'),
  ROSTER_START_DATE: createArrayItemField('roster', 'startDate', 'Roster Member Start Date', 'The start date of a team member in the roster'),
  ROSTER_END_DATE: createArrayItemField('roster', 'endDate', 'Roster Member End Date', 'The end date of a team member in the roster')
};

// Define what the team node publishes
export const TeamPublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    CommonFields.POSITION,
    CommonFields.STATUS,
    CommonFields.CREATED_AT,
    CommonFields.UPDATED_AT,
    TeamFields.ROSTER,
    TeamFields.BANDWIDTH,
    TeamFields.SEASON,
    TeamFields.SEASON_START_DATE,
    TeamFields.SEASON_END_DATE,
    TeamFields.SEASON_NAME,
    TeamFields.SEASON_GOALS,
    TeamFields.ROSTER_MEMBER_ID,
    TeamFields.ROSTER_ALLOCATION,
    TeamFields.ROSTER_ROLE,
    TeamFields.ROSTER_START_DATE,
    TeamFields.ROSTER_END_DATE
  ]
};

// Define what the team node subscribes to
export const TeamSubscribes = {
  nodeTypes: ['teamMember', 'feature'] as NodeType[],
  fields: {
    teamMember: ['title', 'weeklyCapacity', 'roles', 'dailyRate'],
    feature: ['teamAllocations', 'buildType', 'duration']
  }
};

// Export the complete manifest
export const TeamManifest = {
  publishes: TeamPublishes,
  subscribes: TeamSubscribes
}; 