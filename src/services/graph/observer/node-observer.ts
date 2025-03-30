/**
 * TEMPORARY PLACEHOLDER
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * This code is deprecated and will be removed. Please migrate to Synapso events.
 */

// Placeholder types
export enum NodeUpdateType {
  REPLACE = 'REPLACE',
  APPEND = 'APPEND',
  REMOVE = 'REMOVE',
  MANIFEST = 'MANIFEST'
}

export interface NodeUpdateMetadata {
  field?: string;
  source?: string;
  timestamp?: number;
}

// Placeholder functions
export const NodeObserver = {
  getInstance: () => ({
    publishUpdate: () => {
      console.warn('NodeObserver.publishUpdate is deprecated. Please migrate to Synapso events.');
    },
    subscribe: () => {
      console.warn('NodeObserver.subscribe is deprecated. Please migrate to Synapso events.');
      return () => {}; // Unsubscribe function
    }
  })
}; 