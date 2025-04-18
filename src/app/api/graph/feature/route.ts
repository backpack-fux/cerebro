import { NextRequest, NextResponse } from 'next/server';
import { featureService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateFeatureNodeParams, MemberAllocation, TeamAllocation } from '@/services/graph/feature/feature.types';

/**
 * Validates a MemberAllocation object
 * @param allocation The member allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidMemberAllocation(allocation: MemberAllocation): allocation is MemberAllocation {
  return (
    allocation !== null &&
    typeof allocation === 'object' &&
    'memberId' in allocation &&
    'timePercentage' in allocation &&
    typeof allocation.memberId === 'string' &&
    typeof allocation.timePercentage === 'number'
  );
}

/**
 * Validates an array of MemberAllocation objects
 * @param allocations The allocations array to validate
 * @returns True if valid, false otherwise
 */
function isValidMemberAllocations(allocations: MemberAllocation[]): allocations is MemberAllocation[] {
  return Array.isArray(allocations) && allocations.every(isValidMemberAllocation);
}

/**
 * Validates a TeamAllocation object
 * @param allocation The team allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocation(allocation: TeamAllocation): allocation is TeamAllocation {
  return (
    allocation !== null &&
    typeof allocation === 'object' &&
    'teamId' in allocation &&
    'requestedHours' in allocation &&
    'allocatedMembers' in allocation &&
    typeof allocation.teamId === 'string' &&
    typeof allocation.requestedHours === 'number' &&
    Array.isArray(allocation.allocatedMembers) &&
    allocation.allocatedMembers.every((member): member is { memberId: string; hours: number } => 
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

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting FeatureNode creation');
    const params = await req.json();
    
    // Remove any memberAllocations or teamAllocations from the params
    // These will be handled by the service after node creation
    const { memberAllocations, teamAllocations, ...createParams } = params as CreateFeatureNodeParams & {
      memberAllocations?: MemberAllocation[];
      teamAllocations?: TeamAllocation[];
    };
    
    if (!createParams.title || !createParams.position) {
      console.warn('[API] Invalid FeatureNode creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title and position are required' },
        { status: 400 }
      );
    }

    // Validate build type if provided
    if (createParams.buildType && !['internal', 'external'].includes(createParams.buildType)) {
      console.warn('[API] Invalid FeatureNode creation request: Invalid buildType');
      return NextResponse.json(
        { error: 'Invalid buildType. Must be either "internal" or "external".' },
        { status: 400 }
      );
    }

    // Validate time unit if provided
    if (createParams.timeUnit && !['days', 'weeks'].includes(createParams.timeUnit)) {
      console.warn('[API] Invalid FeatureNode creation request: Invalid timeUnit');
      return NextResponse.json(
        { error: 'Invalid timeUnit. Must be either "days" or "weeks".' },
        { status: 400 }
      );
    }

    console.log('[API] Received FeatureNode creation request:', {
      title: createParams.title,
      description: createParams.description,
      position: createParams.position,
      buildType: createParams.buildType,
      duration: createParams.duration,
      timeUnit: createParams.timeUnit,
      status: createParams.status
    });

    // Create the feature node
    const createdNode = await featureService.create(createParams);
    
    // If memberAllocations were provided, add them to the node
    if (memberAllocations && isValidMemberAllocations(memberAllocations)) {
      console.log('[API] Adding member allocations to feature node:', memberAllocations);
      await featureService.update({
        id: createdNode.id,
        memberAllocations
      });
    }
    
    // If teamAllocations were provided, add them to the node
    if (teamAllocations && isValidTeamAllocations(teamAllocations)) {
      console.log('[API] Adding team allocations to feature node:', teamAllocations);
      await featureService.update({
        id: createdNode.id,
        teamAllocations
      });
    }
    
    // Retrieve the node to get the complete data
    const node = await featureService.getById(createdNode.id);
    
    if (!node) {
      console.error('[API] Failed to retrieve created node:', createdNode.id);
      return NextResponse.json(
        { error: 'Failed to retrieve created node' },
        { status: 500 }
      );
    }
    
    // No need to transform since getById already returns RFFeatureNode
    const transformedNode = node;
    
    // Ensure the ID is explicitly set in the response
    transformedNode.id = createdNode.id;
    
    console.log('[API] Successfully created FeatureNode:', {
      id: transformedNode.id,
      type: transformedNode.type,
      position: transformedNode.position,
      data: {
        title: transformedNode.data.title,
        description: transformedNode.data.description,
        buildType: transformedNode.data.buildType,
        duration: transformedNode.data.duration,
        timeUnit: transformedNode.data.timeUnit,
        status: transformedNode.data.status,
        teamMembers: Array.isArray(transformedNode.data.teamMembers) ? `${transformedNode.data.teamMembers.length} members` : 'not provided',
        memberAllocations: Array.isArray(transformedNode.data.memberAllocations) ? `${transformedNode.data.memberAllocations.length} allocations` : 'not provided',
        teamAllocations: Array.isArray(transformedNode.data.teamAllocations) ? `${transformedNode.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    return NextResponse.json(transformedNode, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating FeatureNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create FeatureNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 