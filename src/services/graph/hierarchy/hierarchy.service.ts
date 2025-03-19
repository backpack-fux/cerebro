/**
 * Hierarchical Node Service
 * 
 * This service provides utilities for working with hierarchical node relationships.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { calculateRollupEstimate } from './hierarchy.types';

// Define interfaces for hierarchy node data
export interface HierarchyNodeData {
  id: string;
  title: string;
  name?: string;
  type?: string;
  data?: {
    cost?: number;
    hierarchy?: {
      parentId?: string | null;
      childIds?: string[];
      isRollup?: boolean;
    };
    [key: string]: unknown;
  };
  rollupEstimate?: number;
  originalEstimate?: number;
  rollupContribution?: boolean;
  weight?: number;
  [key: string]: unknown;
}

/**
 * Checks if the given fields include any hierarchy-related fields
 */
export function containsHierarchyFields(fields: string[]): boolean {
  const hierarchyFields = ['parentId', 'childIds', 'isRollup', 'originalEstimate', 'rollupEstimate'];
  return fields.some(field => 
    hierarchyFields.includes(field) || field.startsWith('hierarchy.')
  );
}

/**
 * Checks if the given fields include any metric fields that would require rollup recalculation
 */
export function containsMetricFields(fields: string[]): boolean {
  const metricFields = ['duration', 'cost', 'originalEstimate', 'rollupEstimate'];
  return fields.some(field => metricFields.includes(field));
}

/**
 * Creates a parent-child relationship between two nodes
 */
export async function createParentChildRelationship(
  nodeType: NodeType,
  parentId: string,
  childId: string,
  rollupContribution: boolean = true
): Promise<Response> {
  // Need to use absolute URLs in Node.js environment
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
  
  const response = await fetch(`${baseUrl}/api/graph/${nodeType}/${parentId}/children`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      childId,
      rollupContribution
    }),
  });

  return response;
}

/**
 * Gets all children of a node
 */
export async function getNodeChildren(
  nodeType: NodeType,
  nodeId: string
): Promise<HierarchyNodeData[]> {
  // Need to use absolute URLs in Node.js environment
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
  
  const response = await fetch(`${baseUrl}/api/graph/${nodeType}/${nodeId}/children`);
  
  if (!response.ok) {
    throw new Error(`Failed to get children for ${nodeType} ${nodeId}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

/**
 * Gets the parent of a node
 */
export async function getNodeParent(
  nodeType: NodeType,
  nodeId: string
): Promise<HierarchyNodeData | null> {
  // Need to use absolute URLs in Node.js environment
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
  
  const response = await fetch(`${baseUrl}/api/graph/${nodeType}/${nodeId}/parent`);
  
  if (!response.ok) {
    throw new Error(`Failed to get parent for ${nodeType} ${nodeId}`);
  }
  
  const data = await response.json();
  return data.data || null;
}

/**
 * Removes a parent-child relationship
 */
export async function removeParentChildRelationship(
  nodeType: NodeType,
  parentId: string,
  childId: string
): Promise<Response> {
  // Need to use absolute URLs in Node.js environment
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
  
  const response = await fetch(`${baseUrl}/api/graph/${nodeType}/${parentId}/children/${childId}`, {
    method: 'DELETE',
  });

  return response;
}

/**
 * Updates a node's rollup estimate and cost based on its children
 */
export async function updateRollupEstimate(
  nodeType: NodeType,
  nodeId: string,
  nodeData: HierarchyNodeData
): Promise<void> {
  // Need to use absolute URLs in Node.js environment
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
  
  try {
    // Get all children
    const children = await getNodeChildren(nodeType, nodeId);
    
    console.log(`[HierarchyService] Calculating rollup for ${nodeType} ${nodeId} with ${children.length} children`);
    
    // Extract estimates from children
    const childEstimates = children
      .filter(child => child.rollupContribution !== false) // Only include children that contribute
      .map(child => child.rollupEstimate || child.originalEstimate || 0);

    // Extract costs from children
    const childCosts = children
      .filter(child => child.rollupContribution !== false) // Only include children that contribute
      .map(child => {
        const cost = child.data?.cost || 0;
        console.log(`[HierarchyService] Child ${child.id} has cost: ${cost}`);
        return cost;
      });
    
    // Calculate the rollup estimate
    const rollupEstimate = calculateRollupEstimate(
      nodeData.originalEstimate,
      childEstimates,
      false // Don't include parent's original estimate in calculation
    );

    // Calculate the rollup cost
    const rollupCost = childCosts.reduce((sum: number, cost: number) => sum + cost, 0);
    console.log(`[HierarchyService] Calculated rollup cost: ${rollupCost} and estimate: ${rollupEstimate}`);
    
    // Only update if we have values to update
    if (rollupEstimate > 0 || rollupCost > 0) {
      // Update the node with the new rollup values
      const updateResponse = await fetch(`${baseUrl}/api/graph/${nodeType}/${nodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rollupEstimate,
          cost: rollupCost
        }),
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update node with rollups: ${updateResponse.status}`);
      }
      
      console.log(`[HierarchyService] Updated node ${nodeId} with rollups: cost=${rollupCost}, estimate=${rollupEstimate}`);
    }
  } catch (error) {
    console.error(`[HierarchyService] Error updating rollup estimate for ${nodeType} ${nodeId}:`, error);
    throw error;
  }
}

/**
 * Notifies a parent node of changes in a child node
 */
export async function notifyParentOfChanges(
  nodeType: NodeType,
  nodeId: string,
  changedFields: string[]
): Promise<void> {
  // Get the parent
  const parent = await getNodeParent(nodeType, nodeId);
  
  if (!parent) return;
  
  // If metric fields have changed, update the parent's rollup
  if (containsMetricFields(changedFields)) {
    await updateRollupEstimate(nodeType, parent.id, parent);
  }
}

/**
 * Manually trigger rollup calculation for a parent node
 */
export async function recalculateParentRollup(
  nodeType: NodeType,
  parentId: string
): Promise<void> {
  try {
    // Need to use absolute URLs with fetch in a Node.js environment
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    // Get all children through the service directly
    const childrenResponse = await fetch(`${baseUrl}/api/graph/${nodeType}/${parentId}/children`);
    const childrenData = await childrenResponse.json();
    const children = childrenData.success ? childrenData.data as HierarchyNodeData[] : [];
    
    console.log(`[HierarchyService] Found ${children.length} children for ${nodeType} ${parentId}`);
    
    // Extract costs from children
    const childCosts = children
      .filter((child: HierarchyNodeData) => child.rollupContribution !== false)
      .map((child: HierarchyNodeData) => {
        const cost = child.data?.cost || 0;
        console.log(`[HierarchyService] Child ${child.id} has cost: ${cost}`);
        return cost;
      });
    
    // Calculate the rollup cost
    const rollupCost = childCosts.reduce((sum: number, cost: number) => sum + cost, 0);
    console.log(`[HierarchyService] Calculated rollup cost for ${nodeType} ${parentId}: ${rollupCost}`);
    
    // Update the parent node with the calculated cost
    const updateResponse = await fetch(`${baseUrl}/api/graph/${nodeType}/${parentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cost: rollupCost
      }),
    });
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update parent node: ${updateResponse.status}`);
    }
    
    console.log(`[HierarchyService] Updated cost for ${nodeType} ${parentId} to ${rollupCost}`);
  } catch (error) {
    console.error(`[HierarchyService] Error recalculating rollup for ${nodeType} ${parentId}:`, error);
    throw error;
  }
} 