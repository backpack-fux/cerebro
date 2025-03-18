/**
 * Option Node Manifest
 * 
 * This file defines what data the option node type can publish and subscribe to.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createNestedField, createArrayItemField } from '@/services/graph/base-node/base-manifest';

// Option specific fields
export const OptionFields: Record<string, DataField> = {
  OPTION_TYPE: {
    id: 'optionType',
    name: 'Option Type',
    description: 'The type of option (build, buy, partner)',
    path: 'optionType',
    critical: true
  },
  TRANSACTION_FEE_RATE: {
    id: 'transactionFeeRate',
    name: 'Transaction Fee Rate',
    description: 'The transaction fee rate for this option',
    path: 'transactionFeeRate'
  },
  MONTHLY_VOLUME: {
    id: 'monthlyVolume',
    name: 'Monthly Volume',
    description: 'The expected monthly transaction volume',
    path: 'monthlyVolume'
  },
  DURATION: {
    id: 'duration',
    name: 'Duration',
    description: 'How long this option will take to implement',
    path: 'duration',
    critical: true
  },
  TEAM_MEMBERS: {
    id: 'teamMembers',
    name: 'Team Members',
    description: 'The team members assigned to this option',
    path: 'teamMembers',
    critical: true
  },
  MEMBER_ALLOCATIONS: {
    id: 'memberAllocations',
    name: 'Member Allocations',
    description: 'The allocation of team members to this option',
    path: 'memberAllocations',
    critical: true
  },
  GOALS: {
    id: 'goals',
    name: 'Goals',
    description: 'The goals for this option',
    path: 'goals'
  },
  RISKS: {
    id: 'risks',
    name: 'Risks',
    description: 'The risks associated with this option',
    path: 'risks'
  },
  BUILD_DURATION: {
    id: 'buildDuration',
    name: 'Build Duration',
    description: 'How long it will take to build this option',
    path: 'buildDuration',
    critical: true
  },
  TIME_TO_CLOSE: {
    id: 'timeToClose',
    name: 'Time to Close',
    description: 'Time required to close the deal',
    path: 'timeToClose'
  },
  TEAM_ALLOCATIONS: {
    id: 'teamAllocations',
    name: 'Team Allocations',
    description: 'The teams allocated to this option',
    path: 'teamAllocations',
    critical: true
  },
  // Nested fields for goals
  GOAL_TITLE: createArrayItemField('goals', 'title', 'Goal Title', 'The title of a goal'),
  GOAL_DESCRIPTION: createArrayItemField('goals', 'description', 'Goal Description', 'The description of a goal'),
  GOAL_IMPACT: createArrayItemField('goals', 'impact', 'Goal Impact', 'The impact level of a goal', true),
  // Nested fields for risks
  RISK_TITLE: createArrayItemField('risks', 'title', 'Risk Title', 'The title of a risk'),
  RISK_DESCRIPTION: createArrayItemField('risks', 'description', 'Risk Description', 'The description of a risk'),
  RISK_SEVERITY: createArrayItemField('risks', 'severity', 'Risk Severity', 'The severity level of a risk', true),
  RISK_MITIGATION: createArrayItemField('risks', 'mitigation', 'Risk Mitigation', 'The mitigation strategy for a risk'),
  // Nested fields for member allocations
  MEMBER_ALLOCATION_ID: createArrayItemField('memberAllocations', 'memberId', 'Member ID', 'The ID of an allocated team member'),
  MEMBER_ALLOCATION_HOURS: createArrayItemField('memberAllocations', 'hours', 'Member Hours', 'The hours allocated to a team member', true),
  // Team allocation fields
  TEAM_ALLOCATION_TEAM_ID: createArrayItemField('teamAllocations', 'teamId', 'Team ID', 'The ID of a team allocated to this option'),
  TEAM_ALLOCATION_REQUESTED_HOURS: createArrayItemField('teamAllocations', 'requestedHours', 'Requested Hours', 'The number of hours requested from a team', true),
  TEAM_ALLOCATION_MEMBERS: createArrayItemField('teamAllocations', 'allocatedMembers', 'Allocated Members', 'The members allocated from a team', true),
  // Allocated member details
  ALLOCATED_MEMBER_ID: createNestedField('teamAllocations[].allocatedMembers[]', 'memberId', 'Member ID', 'The ID of an allocated member'),
  ALLOCATED_MEMBER_HOURS: createNestedField('teamAllocations[].allocatedMembers[]', 'hours', 'Member Hours', 'The hours allocated to a member', true)
};

// Define what the option node publishes
export const OptionPublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    CommonFields.POSITION,
    CommonFields.STATUS,
    CommonFields.CREATED_AT,
    CommonFields.UPDATED_AT,
    OptionFields.OPTION_TYPE,
    OptionFields.TRANSACTION_FEE_RATE,
    OptionFields.MONTHLY_VOLUME,
    OptionFields.DURATION,
    OptionFields.TEAM_MEMBERS,
    OptionFields.MEMBER_ALLOCATIONS,
    OptionFields.GOALS,
    OptionFields.RISKS,
    OptionFields.BUILD_DURATION,
    OptionFields.TIME_TO_CLOSE,
    OptionFields.TEAM_ALLOCATIONS,
    OptionFields.GOAL_TITLE,
    OptionFields.GOAL_DESCRIPTION,
    OptionFields.GOAL_IMPACT,
    OptionFields.RISK_TITLE,
    OptionFields.RISK_DESCRIPTION,
    OptionFields.RISK_SEVERITY,
    OptionFields.RISK_MITIGATION,
    OptionFields.MEMBER_ALLOCATION_ID,
    OptionFields.MEMBER_ALLOCATION_HOURS,
    OptionFields.TEAM_ALLOCATION_TEAM_ID,
    OptionFields.TEAM_ALLOCATION_REQUESTED_HOURS,
    OptionFields.TEAM_ALLOCATION_MEMBERS,
    OptionFields.ALLOCATED_MEMBER_ID,
    OptionFields.ALLOCATED_MEMBER_HOURS
  ]
};

// Define what the option node subscribes to
export const OptionSubscribes = {
  nodeTypes: ['team', 'teamMember', 'feature', 'provider'] as NodeType[],
  fields: {
    team: ['title', 'roster', 'bandwidth'],
    teamMember: ['title', 'weeklyCapacity', 'dailyRate'],
    feature: ['title', 'buildType', 'duration'],
    provider: ['title', 'costs', 'duration']
  }
};

// Export the complete manifest
export const OptionManifest = {
  publishes: OptionPublishes,
  subscribes: OptionSubscribes
}; 