/**
 * Provider Node Manifest
 * 
 * This file defines what data the provider node type can publish and subscribe to.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createField, createNestedField, createArrayItemField } from '@/services/graph/base-node/base-manifest';

// Provider specific fields
export const ProviderFields: Record<string, DataField> = {
  DURATION: {
    id: 'duration',
    name: 'Duration',
    description: 'How long this provider engagement will last',
    path: 'duration',
    critical: true
  },
  COSTS: {
    id: 'costs',
    name: 'Costs',
    description: 'The cost structure for this provider',
    path: 'costs',
    critical: true
  },
  DD_ITEMS: {
    id: 'ddItems',
    name: 'Due Diligence Items',
    description: 'The due diligence items for this provider',
    path: 'ddItems'
  },
  TEAM_ALLOCATIONS: {
    id: 'teamAllocations',
    name: 'Team Allocations',
    description: 'The teams and members allocated to this provider',
    path: 'teamAllocations',
    critical: true
  },
  // Nested fields for costs
  COST_NAME: createArrayItemField('costs', 'name', 'Cost Name', 'The name of a cost item'),
  COST_TYPE: createArrayItemField('costs', 'costType', 'Cost Type', 'The type of cost (fixed, unit, revenue, tiered)', true),
  // Fixed cost details
  FIXED_COST_AMOUNT: createNestedField('costs[].details', 'amount', 'Fixed Cost Amount', 'The amount of a fixed cost', true),
  FIXED_COST_FREQUENCY: createNestedField('costs[].details', 'frequency', 'Fixed Cost Frequency', 'The frequency of a fixed cost (monthly, annual)'),
  // Unit cost details
  UNIT_COST_PRICE: createNestedField('costs[].details', 'unitPrice', 'Unit Price', 'The price per unit', true),
  UNIT_COST_TYPE: createNestedField('costs[].details', 'unitType', 'Unit Type', 'The type of unit (user, transaction, etc.)'),
  UNIT_COST_MIN: createNestedField('costs[].details', 'minimumUnits', 'Minimum Units', 'The minimum number of units'),
  UNIT_COST_MAX: createNestedField('costs[].details', 'maximumUnits', 'Maximum Units', 'The maximum number of units'),
  // Revenue cost details
  REVENUE_PERCENTAGE: createNestedField('costs[].details', 'percentage', 'Revenue Percentage', 'The percentage of revenue', true),
  REVENUE_MIN_MONTHLY: createNestedField('costs[].details', 'minimumMonthly', 'Minimum Monthly', 'The minimum monthly revenue'),
  // Tiered cost details
  TIERED_UNIT_TYPE: createNestedField('costs[].details', 'unitType', 'Tiered Unit Type', 'The type of unit for tiered pricing'),
  TIERED_MIN_MONTHLY: createNestedField('costs[].details', 'minimumMonthly', 'Tiered Minimum Monthly', 'The minimum monthly cost for tiered pricing'),
  // Tier details
  TIER_MIN: createNestedField('costs[].details.tiers[]', 'min', 'Tier Minimum', 'The minimum value for a tier'),
  TIER_MAX: createNestedField('costs[].details.tiers[]', 'max', 'Tier Maximum', 'The maximum value for a tier'),
  TIER_UNIT_PRICE: createNestedField('costs[].details.tiers[]', 'unitPrice', 'Tier Unit Price', 'The price per unit for a tier', true),
  // Due diligence items
  DD_ITEM_NAME: createArrayItemField('ddItems', 'name', 'DD Item Name', 'The name of a due diligence item'),
  DD_ITEM_STATUS: createArrayItemField('ddItems', 'status', 'DD Item Status', 'The status of a due diligence item', true),
  DD_ITEM_NOTES: createArrayItemField('ddItems', 'notes', 'DD Item Notes', 'Notes for a due diligence item'),
  DD_ITEM_DUE_DATE: createArrayItemField('ddItems', 'dueDate', 'DD Item Due Date', 'The due date for a due diligence item'),
  DD_ITEM_ASSIGNEE: createArrayItemField('ddItems', 'assignee', 'DD Item Assignee', 'The assignee for a due diligence item'),
  // Team allocation fields
  TEAM_ALLOCATION_TEAM_ID: createArrayItemField('teamAllocations', 'teamId', 'Team ID', 'The ID of a team allocated to this provider'),
  TEAM_ALLOCATION_REQUESTED_HOURS: createArrayItemField('teamAllocations', 'requestedHours', 'Requested Hours', 'The number of hours requested from a team', true),
  TEAM_ALLOCATION_MEMBERS: createArrayItemField('teamAllocations', 'allocatedMembers', 'Allocated Members', 'The members allocated from a team', true),
  // Allocated member details
  ALLOCATED_MEMBER_ID: createNestedField('teamAllocations[].allocatedMembers[]', 'memberId', 'Member ID', 'The ID of an allocated member'),
  ALLOCATED_MEMBER_HOURS: createNestedField('teamAllocations[].allocatedMembers[]', 'hours', 'Member Hours', 'The hours allocated to a member', true)
};

// Define what the provider node publishes
export const ProviderPublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    CommonFields.POSITION,
    CommonFields.STATUS,
    CommonFields.CREATED_AT,
    CommonFields.UPDATED_AT,
    ProviderFields.DURATION,
    ProviderFields.COSTS,
    ProviderFields.DD_ITEMS,
    ProviderFields.TEAM_ALLOCATIONS,
    ProviderFields.COST_NAME,
    ProviderFields.COST_TYPE,
    ProviderFields.FIXED_COST_AMOUNT,
    ProviderFields.FIXED_COST_FREQUENCY,
    ProviderFields.UNIT_COST_PRICE,
    ProviderFields.UNIT_COST_TYPE,
    ProviderFields.UNIT_COST_MIN,
    ProviderFields.UNIT_COST_MAX,
    ProviderFields.REVENUE_PERCENTAGE,
    ProviderFields.REVENUE_MIN_MONTHLY,
    ProviderFields.TIERED_UNIT_TYPE,
    ProviderFields.TIERED_MIN_MONTHLY,
    ProviderFields.TIER_MIN,
    ProviderFields.TIER_MAX,
    ProviderFields.TIER_UNIT_PRICE,
    ProviderFields.DD_ITEM_NAME,
    ProviderFields.DD_ITEM_STATUS,
    ProviderFields.DD_ITEM_NOTES,
    ProviderFields.DD_ITEM_DUE_DATE,
    ProviderFields.DD_ITEM_ASSIGNEE,
    ProviderFields.TEAM_ALLOCATION_TEAM_ID,
    ProviderFields.TEAM_ALLOCATION_REQUESTED_HOURS,
    ProviderFields.TEAM_ALLOCATION_MEMBERS,
    ProviderFields.ALLOCATED_MEMBER_ID,
    ProviderFields.ALLOCATED_MEMBER_HOURS
  ]
};

// Define what the provider node subscribes to
export const ProviderSubscribes = {
  nodeTypes: ['team', 'teamMember', 'feature'] as NodeType[],
  fields: {
    team: ['title', 'roster', 'bandwidth'],
    teamMember: ['title', 'weeklyCapacity', 'dailyRate'],
    feature: ['title', 'buildType', 'duration']
  }
};

// Export the complete manifest
export const ProviderManifest = {
  publishes: ProviderPublishes,
  subscribes: ProviderSubscribes
}; 