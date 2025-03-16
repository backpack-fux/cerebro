/**
 * Team Member Node Manifest
 * 
 * This file defines what data the team member node type can publish and subscribe to.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createField } from '@/services/graph/base-node/base-manifest';

// Team Member specific fields
export const TeamMemberFields: Record<string, DataField> = {
  ROLES: {
    id: 'roles',
    name: 'Roles',
    description: 'The roles this team member can fulfill',
    path: 'roles',
    critical: true
  },
  BIO: {
    id: 'bio',
    name: 'Bio',
    description: 'Biographical information about the team member',
    path: 'bio'
  },
  TIMEZONE: {
    id: 'timezone',
    name: 'Timezone',
    description: 'The timezone the team member is in',
    path: 'timezone'
  },
  DAILY_RATE: {
    id: 'dailyRate',
    name: 'Daily Rate',
    description: 'The daily rate charged by this team member',
    path: 'dailyRate',
    critical: true
  },
  HOURS_PER_DAY: {
    id: 'hoursPerDay',
    name: 'Hours Per Day',
    description: 'The number of hours per day this member can work',
    path: 'hoursPerDay',
    critical: true
  },
  DAYS_PER_WEEK: {
    id: 'daysPerWeek',
    name: 'Days Per Week',
    description: 'The number of days per week this member can work',
    path: 'daysPerWeek',
    critical: true
  },
  WEEKLY_CAPACITY: {
    id: 'weeklyCapacity',
    name: 'Weekly Capacity',
    description: 'The number of hours per week this member can work',
    path: 'weeklyCapacity',
    critical: true
  },
  START_DATE: {
    id: 'startDate',
    name: 'Start Date',
    description: 'The date this team member is available from',
    path: 'startDate'
  },
  SKILLS: {
    id: 'skills',
    name: 'Skills',
    description: 'The skills this team member has',
    path: 'skills'
  },
  TEAM_ID: {
    id: 'teamId',
    name: 'Team ID',
    description: 'The ID of the team this member is assigned to',
    path: 'teamId'
  },
  ALLOCATION: {
    id: 'allocation',
    name: 'Allocation',
    description: 'The percentage of time this member is allocated to their team',
    path: 'allocation',
    critical: true
  }
};

// Define what the team member node publishes
export const TeamMemberPublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    CommonFields.POSITION,
    CommonFields.STATUS,
    CommonFields.CREATED_AT,
    CommonFields.UPDATED_AT,
    TeamMemberFields.ROLES,
    TeamMemberFields.BIO,
    TeamMemberFields.TIMEZONE,
    TeamMemberFields.DAILY_RATE,
    TeamMemberFields.HOURS_PER_DAY,
    TeamMemberFields.DAYS_PER_WEEK,
    TeamMemberFields.WEEKLY_CAPACITY,
    TeamMemberFields.START_DATE,
    TeamMemberFields.SKILLS,
    TeamMemberFields.TEAM_ID,
    TeamMemberFields.ALLOCATION
  ]
};

// Define what the team member node subscribes to
export const TeamMemberSubscribes = {
  nodeTypes: ['team', 'feature'] as NodeType[],
  fields: {
    team: ['roster', 'bandwidth'],
    feature: ['teamAllocations']
  }
};

// Export the complete manifest
export const TeamMemberManifest = {
  publishes: TeamMemberPublishes,
  subscribes: TeamMemberSubscribes
}; 