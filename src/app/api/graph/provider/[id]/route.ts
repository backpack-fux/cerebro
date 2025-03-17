import { NextRequest, NextResponse } from 'next/server';
import { ProviderService } from '@/services/graph/provider/provider.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateProviderNodeParams, Neo4jProviderNodeData, ProviderCost, DDItem, TeamAllocation } from '@/services/graph/provider/provider.types';
import { neo4jToReactFlow } from '@/services/graph/provider/provider.transform';
import { parseTeamAllocations } from '@/utils/utils';

// Initialize the provider service
const providerService = new ProviderService(neo4jStorage);

/**
 * Validates a ProviderCost object
 * @param cost The provider cost to validate
 * @returns True if valid, false otherwise
 */
function isValidProviderCost(cost: any): cost is ProviderCost {
  if (!cost || typeof cost !== 'object' || !cost.id || !cost.name || !cost.costType || !cost.details) {
    return false;
  }

  // Validate based on cost type
  switch (cost.costType) {
    case 'fixed':
      return (
        typeof cost.details.type === 'string' &&
        typeof cost.details.amount === 'number' &&
        ['monthly', 'annual'].includes(cost.details.frequency)
      );
    case 'unit':
      return (
        typeof cost.details.type === 'string' &&
        typeof cost.details.unitPrice === 'number' &&
        typeof cost.details.unitType === 'string'
      );
    case 'revenue':
      return (
        typeof cost.details.type === 'string' &&
        typeof cost.details.percentage === 'number'
      );
    case 'tiered':
      return (
        typeof cost.details.type === 'string' &&
        typeof cost.details.unitType === 'string' &&
        Array.isArray(cost.details.tiers) &&
        cost.details.tiers.every((tier: any) => 
          typeof tier.min === 'number' && 
          typeof tier.unitPrice === 'number'
        )
      );
    default:
      return false;
  }
}

/**
 * Validates an array of ProviderCost objects
 * @param costs The costs array to validate
 * @returns True if valid, false otherwise
 */
function isValidProviderCosts(costs: any): costs is ProviderCost[] {
  return Array.isArray(costs) && costs.every(isValidProviderCost);
}

/**
 * Validates a DDItem object
 * @param item The DD item to validate
 * @returns True if valid, false otherwise
 */
function isValidDDItem(item: any): item is DDItem {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    ['pending', 'in_progress', 'completed', 'blocked'].includes(item.status)
  );
}

/**
 * Validates an array of DDItem objects
 * @param items The items array to validate
 * @returns True if valid, false otherwise
 */
function isValidDDItems(items: any): items is DDItem[] {
  return Array.isArray(items) && items.every(isValidDDItem);
}

/**
 * Validates a TeamAllocation object
 * @param allocation The team allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocation(allocation: any): allocation is TeamAllocation {
  return (
    allocation &&
    typeof allocation === 'object' &&
    typeof allocation.teamId === 'string' &&
    typeof allocation.requestedHours === 'number' &&
    Array.isArray(allocation.allocatedMembers) &&
    allocation.allocatedMembers.every((member: any) => 
      typeof member === 'object' &&
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
function isValidTeamAllocations(allocations: any): allocations is TeamAllocation[] {
  // If it's a string, try to parse it first
  if (typeof allocations === 'string') {
    try {
      const parsed = JSON.parse(allocations);
      return Array.isArray(parsed) && parsed.every(isValidTeamAllocation);
    } catch (e) {
      console.warn('[API] Failed to parse teamAllocations string:', e);
      return false;
    }
  }
  
  // If it's already an array, validate directly
  return Array.isArray(allocations) && allocations.every(isValidTeamAllocation);
}

// GET /api/graph/provider/[id] - Get a provider node by ID
export async function GET(request: NextRequest) {
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

    // Use the neo4jStorage to get the node
    const rawNode = await neo4jStorage.getNode(id);
    
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
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/provider/[id] - Update a provider node by ID
export async function PATCH(request: NextRequest) {
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
      console.log('[API DEBUG] Raw teamAllocations received:', JSON.stringify(updateData.teamAllocations));
      console.log('[API DEBUG] teamAllocations type:', typeof updateData.teamAllocations);
      console.log('[API DEBUG] Is Array?', Array.isArray(updateData.teamAllocations));
      
      // Try to parse it if it's a string
      if (typeof updateData.teamAllocations === 'string') {
        try {
          const parsed = JSON.parse(updateData.teamAllocations);
          console.log('[API DEBUG] Parsed teamAllocations:', JSON.stringify(parsed));
          console.log('[API DEBUG] Parsed is array?', Array.isArray(parsed));
          
          // If it parses to an array but still fails validation, show more details
          if (Array.isArray(parsed)) {
            const invalidItems = parsed.filter(item => !isValidTeamAllocation(item));
            console.log('[API DEBUG] Invalid items in teamAllocations:', JSON.stringify(invalidItems));
          }
        } catch (e) {
          console.log('[API DEBUG] Failed to parse teamAllocations string:', e);
        }
      }
      
      return NextResponse.json(
        { error: 'Invalid teamAllocations array. Each allocation must have teamId, requestedHours, and allocatedMembers properties.' },
        { status: 400 }
      );
    }
    
    // Check if the node exists first
    const node = await neo4jStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] ProviderNode not found for update:', id);
      return NextResponse.json(
        { error: 'ProviderNode not found' },
        { status: 404 }
      );
    }

    // Convert complex objects to JSON strings
    const cleanUpdateData: any = { ...updateData };
    if (cleanUpdateData.costs) {
      cleanUpdateData.costs = JSON.stringify(cleanUpdateData.costs);
    }
    if (cleanUpdateData.ddItems) {
      cleanUpdateData.ddItems = JSON.stringify(cleanUpdateData.ddItems);
    }
    if (cleanUpdateData.teamAllocations !== undefined) {
      // If it's a string, parse it back to an array for the service
      if (typeof cleanUpdateData.teamAllocations === 'string') {
        try {
          const parsed = JSON.parse(cleanUpdateData.teamAllocations);
          if (Array.isArray(parsed)) {
            cleanUpdateData.teamAllocations = parsed;
          }
        } catch (e) {
          console.warn('[API] Failed to parse teamAllocations string for service update:', e);
          // Keep it as a string if parsing fails
        }
      }
      
      // The service will handle converting it to a string for Neo4j
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

    // Use the providerService to update the node
    const updatedNode = await providerService.update(cleanUpdateData);
    
    // Ensure complex objects are properly parsed
    if (typeof updatedNode.data.costs === 'string') {
      try {
        updatedNode.data.costs = JSON.parse(updatedNode.data.costs);
      } catch (e) {
        updatedNode.data.costs = [];
      }
    }
    
    if (typeof updatedNode.data.ddItems === 'string') {
      try {
        updatedNode.data.ddItems = JSON.parse(updatedNode.data.ddItems);
      } catch (e) {
        updatedNode.data.ddItems = [];
      }
    }
    
    if (typeof updatedNode.data.teamAllocations === 'string') {
      try {
        console.log('[API DEBUG] Before parse - teamAllocations string:', updatedNode.data.teamAllocations);
        updatedNode.data.teamAllocations = JSON.parse(updatedNode.data.teamAllocations);
        console.log('[API DEBUG] After parse - teamAllocations:', JSON.stringify(updatedNode.data.teamAllocations));
      } catch (e) {
        console.error('[API DEBUG] Error parsing teamAllocations:', e);
        updatedNode.data.teamAllocations = [];
      }
    } else {
      console.log('[API DEBUG] teamAllocations not a string:', typeof updatedNode.data.teamAllocations);
    }

    // Ensure the ID is included in the response
    updatedNode.id = id;

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

    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating ProviderNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/provider/[id] - Delete a provider node by ID
export async function DELETE(request: NextRequest) {
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
    const node = await neo4jStorage.getNode(id);
    
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting ProviderNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 