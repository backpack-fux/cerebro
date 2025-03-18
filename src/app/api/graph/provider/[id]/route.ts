import { NextRequest, NextResponse } from 'next/server';
import { createProviderStorage, createProviderService } from '@/services/graph/neo4j/neo4j.provider';
import { 
  UpdateProviderNodeParams, 
  Neo4jProviderNodeData, 
  ProviderCost, 
  DDItem, 
  TeamAllocation, 
  FixedCost,
  UnitCost,
  RevenueCost,
  TieredCost,
  DDStatus
} from '@/services/graph/provider/provider.types';
import { neo4jToReactFlow } from '@/services/graph/provider/provider.transform';

// Initialize provider service with the correct storage type
const providerStorage = createProviderStorage();
const providerService = createProviderService(providerStorage);

/**
 * Validates a ProviderCost object
 * @param cost The provider cost to validate
 * @returns True if valid, false otherwise
 */
function isValidProviderCost(cost: ProviderCost): cost is ProviderCost {
  if (!cost || typeof cost !== 'object' || !('id' in cost) || !('name' in cost) || !('costType' in cost) || !('details' in cost)) {
    return false;
  }

  // Validate based on cost type
  switch (cost.costType) {
    case 'fixed': {
      const details = cost.details as FixedCost;
      return (
        typeof details.type === 'string' &&
        typeof details.amount === 'number' &&
        ['monthly', 'annual'].includes(details.frequency)
      );
    }
    case 'unit': {
      const details = cost.details as UnitCost;
      return (
        typeof details.type === 'string' &&
        typeof details.unitPrice === 'number' &&
        typeof details.unitType === 'string'
      );
    }
    case 'revenue': {
      const details = cost.details as RevenueCost;
      return (
        typeof details.type === 'string' &&
        typeof details.percentage === 'number'
      );
    }
    case 'tiered': {
      const details = cost.details as TieredCost;
      return (
        typeof details.type === 'string' &&
        typeof details.unitType === 'string' &&
        Array.isArray(details.tiers) &&
        details.tiers.every((tier) => 
          typeof tier.min === 'number' && 
          typeof tier.unitPrice === 'number'
        )
      );
    }
    default:
      return false;
  }
}

/**
 * Validates an array of ProviderCost objects
 * @param costs The costs array to validate
 * @returns True if valid, false otherwise
 */
function isValidProviderCosts(costs: ProviderCost[]): costs is ProviderCost[] {
  return Array.isArray(costs) && costs.every(isValidProviderCost);
}

/**
 * Validates a DDItem object
 * @param item The DD item to validate
 * @returns True if valid, false otherwise
 */
function isValidDDItem(item: DDItem): item is DDItem {
  if (!item || typeof item !== 'object') return false;
  
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    ['pending', 'in_progress', 'completed', 'blocked'].includes(item.status as DDStatus)
  );
}

/**
 * Validates an array of DDItem objects
 * @param items The items array to validate
 * @returns True if valid, false otherwise
 */
function isValidDDItems(items: DDItem[]): items is DDItem[] {
  return Array.isArray(items) && items.every(isValidDDItem);
}

/**
 * Validates a TeamAllocation object
 * @param allocation The team allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocation(allocation: TeamAllocation): allocation is TeamAllocation {
  if (!allocation || typeof allocation !== 'object' || !('allocatedMembers' in allocation)) {
    return false;
  }

  return (
    typeof allocation.teamId === 'string' &&
    typeof allocation.requestedHours === 'number' &&
    Array.isArray(allocation.allocatedMembers) &&
    allocation.allocatedMembers.every((member) => 
      member !== null &&
      typeof member === 'object' &&
      'memberId' in member &&
      'hours' in member &&
      typeof member.memberId === 'string' &&
      typeof member.hours === 'number'
    )
  );
}

/**
 * Validates an array of TeamAllocation objects
 * @param allocations The allocations array to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocations(allocations: TeamAllocation[]): allocations is TeamAllocation[] {
  return Array.isArray(allocations) && allocations.every(isValidTeamAllocation);
}

// GET /api/graph/provider/[id] - Get a provider node by ID
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting ProviderNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Use the providerStorage to get the node
    const rawNode = await providerStorage.getNode(id);
    
    if (!rawNode) {
      console.warn('[API] ProviderNode not found:', id);
      return NextResponse.json(
        { error: 'ProviderNode not found' },
        { status: 404 }
      );
    }

    // Transform the node to properly parse JSON strings
    const node = neo4jToReactFlow(rawNode.data as unknown as Neo4jProviderNodeData);

    // Set position if it's missing
    if (!node.position || (node.position.x === undefined && node.position.y === undefined)) {
      node.position = {
        x: rawNode.position?.x || 0,
        y: rawNode.position?.y || 0
      };
    }

    // Ensure the ID is included in the response
    node.id = id;

    console.log('[API] Successfully retrieved ProviderNode:', {
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        title: node.data.title,
        description: node.data.description,
        duration: node.data.duration,
        status: node.data.status,
        costs: Array.isArray(node.data.costs) ? `${node.data.costs.length} costs` : 'not provided',
        ddItems: Array.isArray(node.data.ddItems) ? `${node.data.ddItems.length} items` : 'not provided',
        teamAllocations: Array.isArray(node.data.teamAllocations) ? `${node.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    // Return the transformed node
    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error getting ProviderNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
      
      // Return specific error response based on Neo4j error code
      if (neo4jError.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
        return NextResponse.json(
          { error: 'Database constraint violation', details: neo4jError.message },
          { status: 409 }
        );
      } else if (neo4jError.code.startsWith('Neo.ClientError')) {
        return NextResponse.json(
          { error: 'Database client error', details: neo4jError.message },
          { status: 400 }
        );
      } else if (neo4jError.code.startsWith('Neo.TransientError')) {
        return NextResponse.json(
          { error: 'Temporary database error, please retry', details: neo4jError.message },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to get ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/provider/[id] - Update a provider node by ID
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating ProviderNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updateData: UpdateProviderNodeParams = await request.json();
    
    // Ensure the ID is included in the update params
    updateData.id = id;
    
    // Validate costs if provided
    if (updateData.costs !== undefined && !isValidProviderCosts(updateData.costs)) {
      console.warn('[API] Invalid ProviderNode update request: Invalid costs array');
      return NextResponse.json(
        { error: 'Invalid costs array. Each cost must have id, name, costType, and details properties.' },
        { status: 400 }
      );
    }

    // Validate DD items if provided
    if (updateData.ddItems !== undefined && !isValidDDItems(updateData.ddItems)) {
      console.warn('[API] Invalid ProviderNode update request: Invalid ddItems array');
      return NextResponse.json(
        { error: 'Invalid ddItems array. Each item must have id, name, and status properties.' },
        { status: 400 }
      );
    }

    // Validate team allocations if provided
    if (updateData.teamAllocations !== undefined && !isValidTeamAllocations(updateData.teamAllocations)) {
      console.warn('[API] Invalid ProviderNode update request: Invalid teamAllocations array');
      return NextResponse.json(
        { error: 'Invalid teamAllocations array. Each allocation must have teamId, requestedHours, and allocatedMembers properties.' },
        { status: 400 }
      );
    }

    // Check if the node exists first
    const node = await providerStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] ProviderNode not found for update:', id);
      return NextResponse.json(
        { error: 'ProviderNode not found' },
        { status: 404 }
      );
    }

    console.log('[API] Updating ProviderNode with data:', {
      id: updateData.id,
      position: updateData.position,
      title: updateData.title,
      description: updateData.description,
      duration: updateData.duration,
      status: updateData.status,
      costs: updateData.costs ? `${updateData.costs.length} costs` : 'not provided',
      ddItems: updateData.ddItems ? `${updateData.ddItems.length} items` : 'not provided',
      teamAllocations: updateData.teamAllocations ? `${updateData.teamAllocations.length} allocations` : 'not provided'
    });

    // Update the provider node
    const updatedNode = await providerService.update(updateData);

    // Ensure complex objects are properly parsed
    if (typeof updatedNode.data.costs === 'string') {
      try {
        updatedNode.data.costs = JSON.parse(updatedNode.data.costs);
      } catch {
        updatedNode.data.costs = [];
      }
    }
    
    if (typeof updatedNode.data.ddItems === 'string') {
      try {
        updatedNode.data.ddItems = JSON.parse(updatedNode.data.ddItems);
      } catch {
        updatedNode.data.ddItems = [];
      }
    }
    
    if (typeof updatedNode.data.teamAllocations === 'string') {
      try {
        updatedNode.data.teamAllocations = JSON.parse(updatedNode.data.teamAllocations);
      } catch {
        updatedNode.data.teamAllocations = [];
      }
    }

    console.log('[API] Successfully updated ProviderNode:', {
      id: updatedNode.id,
      type: updatedNode.type,
      data: {
        title: updatedNode.data.title,
        description: updatedNode.data.description,
        duration: updatedNode.data.duration,
        status: updatedNode.data.status,
        costs: Array.isArray(updatedNode.data.costs) ? `${updatedNode.data.costs.length} costs` : 'not provided',
        ddItems: Array.isArray(updatedNode.data.ddItems) ? `${updatedNode.data.ddItems.length} items` : 'not provided',
        teamAllocations: Array.isArray(updatedNode.data.teamAllocations) ? `${updatedNode.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    // Return the updated node
    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating ProviderNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
      
      // Return specific error response based on Neo4j error code
      if (neo4jError.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
        return NextResponse.json(
          { error: 'Database constraint violation', details: neo4jError.message },
          { status: 409 }
        );
      } else if (neo4jError.code.startsWith('Neo.ClientError')) {
        return NextResponse.json(
          { error: 'Database client error', details: neo4jError.message },
          { status: 400 }
        );
      } else if (neo4jError.code.startsWith('Neo.TransientError')) {
        return NextResponse.json(
          { error: 'Temporary database error, please retry', details: neo4jError.message },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to update ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/provider/[id] - Delete a provider node by ID
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting ProviderNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if the node exists first
    const node = await providerStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] ProviderNode not found for deletion:', id);
      return NextResponse.json(
        { error: 'ProviderNode not found' },
        { status: 404 }
      );
    }

    // Use the providerService to delete the node
    await providerService.delete(id);
    
    console.log('[API] Successfully deleted ProviderNode:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting ProviderNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
      
      // Return specific error response based on Neo4j error code
      if (neo4jError.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
        return NextResponse.json(
          { error: 'Database constraint violation', details: neo4jError.message },
          { status: 409 }
        );
      } else if (neo4jError.code.startsWith('Neo.ClientError')) {
        return NextResponse.json(
          { error: 'Database client error', details: neo4jError.message },
          { status: 400 }
        );
      } else if (neo4jError.code.startsWith('Neo.TransientError')) {
        return NextResponse.json(
          { error: 'Temporary database error, please retry', details: neo4jError.message },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to delete ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 