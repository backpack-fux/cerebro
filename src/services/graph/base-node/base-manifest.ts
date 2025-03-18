/**
 * Base Node Manifest
 * 
 * This file defines common fields and utilities that can be used by all node types.
 */

import { DataField } from '@/services/graph/observer/node-manifest';

/**
 * Common fields that are shared across all node types
 */
export const CommonFields: Record<string, DataField> = {
  TITLE: {
    id: 'title',
    name: 'Title',
    description: 'The title or name of the node',
    path: 'title',
    critical: true
  },
  DESCRIPTION: {
    id: 'description',
    name: 'Description',
    description: 'The description or details of the node',
    path: 'description'
  },
  POSITION: {
    id: 'position',
    name: 'Position',
    description: 'The x,y coordinates of the node',
    path: 'position'
  },
  STATUS: {
    id: 'status',
    name: 'Status',
    description: 'The current status of the node',
    path: 'status',
    critical: true
  },
  CREATED_AT: {
    id: 'createdAt',
    name: 'Created At',
    description: 'When the node was created',
    path: 'createdAt'
  },
  UPDATED_AT: {
    id: 'updatedAt',
    name: 'Updated At',
    description: 'When the node was last updated',
    path: 'updatedAt'
  }
};

/**
 * Helper function to create a data field
 */
export function createField(
  id: string,
  name: string,
  description: string,
  path: string,
  critical: boolean = false
): DataField {
  return {
    id,
    name,
    description,
    path,
    critical
  };
}

/**
 * Helper function to create a nested data field
 */
export function createNestedField(
  parentPath: string,
  id: string,
  name: string,
  description: string,
  critical: boolean = false
): DataField {
  return createField(
    `${parentPath}.${id}`,
    name,
    description,
    `${parentPath}.${id}`,
    critical
  );
}

/**
 * Helper function to create an array item field
 */
export function createArrayItemField(
  arrayPath: string,
  id: string,
  name: string,
  description: string,
  critical: boolean = false
): DataField {
  return createField(
    `${arrayPath}[].${id}`,
    name,
    description,
    `${arrayPath}[].${id}`,
    critical
  );
} 