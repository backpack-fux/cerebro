import { NextRequest, NextResponse } from 'next/server';
import { CreateProviderNodeParams, ProviderCost, DDItem, TeamAllocation } from '@/services/graph/provider/provider.types';
import { providerService } from '@/services/graph/neo4j/neo4j.provider';

/**
 * Validates a ProviderCost object
 * @param cost The provider cost to validate
 * @returns True if valid, false otherwise
 */
function isValidProviderCost(cost: unknown): cost is ProviderCost {
  if (!cost || typeof cost !== 'object' || !('id' in cost) || !('name' in cost) || !('costType' in cost) || !('details' in cost)) {
    return false;
  }

  const { costType, details } = cost as ProviderCost;

  // First validate common fields
  if (typeof details !== 'object' || !details || typeof details.type !== 'string') {
    return false;
  }

  // Validate based on cost type
  switch (costType) {
    case 'fixed': {
      const fixedDetails = details as { type: string; amount: number; frequency: string };
      return (
        typeof fixedDetails.amount === 'number' &&
        typeof fixedDetails.frequency === 'string' &&
        ['monthly', 'annual'].includes(fixedDetails.frequency)
      );
    }
    case 'unit': {
      const unitDetails = details as { type: string; unitPrice: number; unitType: string };
      return (
        typeof unitDetails.unitPrice === 'number' &&
        typeof unitDetails.unitType === 'string'
      );
    }
    case 'revenue': {
      const revenueDetails = details as { type: string; percentage: number };
      return typeof revenueDetails.percentage === 'number';
    }
    case 'tiered': {
      const tieredDetails = details as { type: string; unitType: string; tiers: unknown[] };
      return (
        typeof tieredDetails.unitType === 'string' &&
        Array.isArray(tieredDetails.tiers) &&
        tieredDetails.tiers.every((tier: unknown) => 
          tier !== null &&
          typeof tier === 'object' &&
          'min' in tier &&
          'unitPrice' in tier &&
          typeof (tier as { min: number }).min === 'number' && 
          typeof (tier as { unitPrice: number }).unitPrice === 'number'
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
function isValidProviderCosts(costs: unknown): costs is ProviderCost[] {
  return Array.isArray(costs) && costs.every(isValidProviderCost);
}

/**
 * Validates a DDItem object
 * @param item The DD item to validate
 * @returns True if valid, false otherwise
 */
function isValidDDItem(item: unknown): item is DDItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    'id' in item &&
    'name' in item &&
    'status' in item &&
    typeof (item as DDItem).id === 'string' &&
    typeof (item as DDItem).name === 'string' &&
    ['pending', 'in_progress', 'completed', 'blocked'].includes((item as DDItem).status)
  );
}

/**
 * Validates an array of DDItem objects
 * @param items The items array to validate
 * @returns True if valid, false otherwise
 */
function isValidDDItems(items: unknown): items is DDItem[] {
  return Array.isArray(items) && items.every(isValidDDItem);
}

/**
 * Validates a TeamAllocation object
 * @param allocation The team allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocation(allocation: unknown): allocation is TeamAllocation {
  if (!allocation || typeof allocation !== 'object') return false;
  
  const typedAllocation = allocation as TeamAllocation;
  return (
    typeof typedAllocation.teamId === 'string' &&
    typeof typedAllocation.requestedHours === 'number' &&
    Array.isArray(typedAllocation.allocatedMembers) &&
    typedAllocation.allocatedMembers.every((member: unknown) => 
      member !== null &&
      typeof member === 'object' &&
      'memberId' in member &&
      'hours' in member &&
      typeof (member as { memberId: string }).memberId === 'string' &&
      typeof (member as { hours: number }).hours === 'number'
    )
  );
}

/**
 * Validates an array of TeamAllocation objects
 * @param allocations The allocations array to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocations(allocations: unknown): allocations is TeamAllocation[] {
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
    const params = await req.json();
    
    // Remove any costs, ddItems, or teamAllocations from the params
    // These will be handled by the service after node creation
    const { costs, ddItems, teamAllocations, ...createParams } = params as Partial<CreateProviderNodeParams & {
      costs: unknown;
      ddItems: unknown;
      teamAllocations: unknown;
    }>;
    
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
    const createdNode = await providerService.create(createParams as CreateProviderNodeParams);
    
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
    const node = await providerService.getById(createdNode.id);
    
    if (!node) {
      console.error('[API] Failed to retrieve created node:', createdNode.id);
      return NextResponse.json(
        { error: 'Failed to retrieve created node' },
        { status: 500 }
      );
    }
    
    // No need to transform since getById already returns RFProviderNode
    const transformedNode = node;
    
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
    console.error('[API] Error creating ProviderNode:', error);
    return NextResponse.json(
      { error: 'Failed to create ProviderNode' },
      { status: 500 }
    );
  }
} 