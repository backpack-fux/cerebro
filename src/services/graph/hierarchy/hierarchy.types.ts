/**
 * Hierarchical Node Relationships
 * 
 * This file defines types and interfaces for hierarchical parent-child relationships
 * that can be applied to various node types in the system.
 */

/**
 * Defines the hierarchical relationship for a node
 */
export interface HierarchicalNodeRelationship {
  /** ID of the parent node (null if this is a root node) */
  parentId: string | null;
  
  /** IDs of child nodes */
  childIds: string[];
  
  /** Whether this node aggregates values from its children */
  isRollup: boolean;
}

/**
 * Edge type for parent-child relationships
 */
export const PARENT_CHILD_EDGE_TYPE = 'PARENT_CHILD';

/**
 * Interface for edge data specific to parent-child relationships
 */
export interface ParentChildEdgeData {
  /** The type of edge */
  edgeType: typeof PARENT_CHILD_EDGE_TYPE;
  
  /** Whether this child contributes to parent metrics */
  rollupContribution: boolean;
  
  /** Optional weight for weighted calculations */
  weight?: number;
}

/**
 * Extension interface that can be added to any node data
 */
export interface HierarchicalNodeData {
  /** The hierarchical relationship data */
  hierarchy?: HierarchicalNodeRelationship;
  
  /** The original estimate value set directly on this node */
  originalEstimate?: number;
  
  /** The calculated estimate value that includes rollups from children */
  rollupEstimate?: number;
}

/**
 * Calculate the rollup estimate for a parent node based on its children
 * 
 * @param originalEstimate The parent node's own estimate
 * @param childEstimates Array of estimates from child nodes
 * @param includeOriginal Whether to include the parent's original estimate in the calculation
 * @returns The calculated rollup estimate
 */
export function calculateRollupEstimate(
  originalEstimate: number | undefined,
  childEstimates: number[],
  includeOriginal: boolean = false
): number {
  // Start with 0 or the original estimate based on the includeOriginal flag
  const baseEstimate = includeOriginal && originalEstimate ? originalEstimate : 0;
  
  // Sum up all child estimates
  return childEstimates.reduce((sum, estimate) => sum + estimate, baseEstimate);
} 