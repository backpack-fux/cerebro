import { NextRequest, NextResponse } from 'next/server';
import { ProviderService } from '@/services/graph/provider/provider.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { CreateProviderNodeParams, RFProviderNode, Neo4jProviderNodeData, ProviderCost, DDItem, TeamAllocation } from '@/services/graph/provider/provider.types';
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

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting ProviderNode creation');
    const params: CreateProviderNodeParams = await req.json();
    
    // Remove any costs, ddItems, or teamAllocations from the params
    // These will be handled by the service after node creation
    const { costs, ddItems, teamAllocations, ...createParams } = params as any;
    
    if (!createParams.title || !createParams.position) {
      console.warn('[API] Invalid ProviderNode creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title and position are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received ProviderNode creation request:', {
      title: createParams.title,
      description: createParams.description,
      position: createParams.position,
      duration: createParams.duration,
      status: createParams.status
    });

    // Create the provider node
    const createdNode = await providerService.create(createParams);
    
    // If costs were provided, add them to the node
    if (costs && isValidProviderCosts(costs)) {
      console.log('[API] Adding costs to provider node:', costs);
      await providerService.update({
        id: createdNode.id,
        costs
      });
    }
    
    // If ddItems were provided, add them to the node
    if (ddItems && isValidDDItems(ddItems)) {
      console.log('[API] Adding DD items to provider node:', ddItems);
      await providerService.update({
        id: createdNode.id,
        ddItems
      });
    }
    
    // If teamAllocations were provided, add them to the node
    if (teamAllocations !== undefined) {
      console.log('[API] Adding team allocations to provider node:', 
        typeof teamAllocations === 'string' ? teamAllocations : JSON.stringify(teamAllocations));
      console.log('[API DEBUG] teamAllocations type:', typeof teamAllocations);
      console.log('[API DEBUG] Is Array?', Array.isArray(teamAllocations));
      
      if (!isValidTeamAllocations(teamAllocations)) {
        console.warn('[API] Invalid teamAllocations provided');
        
        // Try to parse it if it's a string
        if (typeof teamAllocations === 'string') {
          try {
            const parsed = JSON.parse(teamAllocations);
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
      } else {
        // For the provider service, we need to pass the original array or the parsed array
        let teamAllocationsArray: TeamAllocation[] = [];
        
        // If it's a string, parse it back to an array for the service
        if (typeof teamAllocations === 'string') {
          try {
            const parsed = JSON.parse(teamAllocations);
            if (Array.isArray(parsed)) {
              teamAllocationsArray = parsed;
            }
          } catch (e) {
            console.warn('[API] Failed to parse teamAllocations string for service update:', e);
          }
        } else if (Array.isArray(teamAllocations)) {
          teamAllocationsArray = teamAllocations;
        }
        
        await providerService.update({
          id: createdNode.id,
          teamAllocations: teamAllocationsArray
        });
      }
    }
    
    // Retrieve the node to get the complete data
    const node = await neo4jStorage.getNode(createdNode.id);
    
    if (!node) {
      console.error('[API] Failed to retrieve created node:', createdNode.id);
      return NextResponse.json(
        { error: 'Failed to retrieve created node' },
        { status: 500 }
      );
    }
    
    // Transform the node to properly parse JSON strings
    const transformedNode = neo4jToReactFlow(node.data as unknown as Neo4jProviderNodeData);
    
    // Ensure the ID is included in the response
    transformedNode.id = createdNode.id;
    
    console.log('[API] Successfully created ProviderNode:', {
      id: transformedNode.id,
      type: transformedNode.type,
      position: transformedNode.position,
      data: {
        title: transformedNode.data.title,
        description: transformedNode.data.description,
        duration: transformedNode.data.duration,
        status: transformedNode.data.status,
        costs: Array.isArray(transformedNode.data.costs) ? `${transformedNode.data.costs.length} costs` : 'not provided',
        ddItems: Array.isArray(transformedNode.data.ddItems) ? `${transformedNode.data.ddItems.length} items` : 'not provided',
        teamAllocations: Array.isArray(transformedNode.data.teamAllocations) ? `${transformedNode.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    return NextResponse.json(transformedNode, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating ProviderNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 