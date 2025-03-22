import { NextRequest, NextResponse } from 'next/server';
import { featureService } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateFeatureNodeParams, Neo4jFeatureNodeData, MemberAllocation, TeamAllocation } from '@/services/graph/feature/feature.types';
import { neo4jToReactFlow } from '@/services/graph/feature/feature.transform';

/**
 * Validates a MemberAllocation object
 * @param allocation The member allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidMemberAllocation(allocation: MemberAllocation): allocation is MemberAllocation {
  return (
    allocation &&
    typeof allocation === 'object' &&
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
    allocation &&
    typeof allocation === 'object' &&
    typeof allocation.teamId === 'string' &&
    typeof allocation.requestedHours === 'number' &&
    Array.isArray(allocation.allocatedMembers) &&
    allocation.allocatedMembers.every((member: { memberId: string; hours: number }) => 
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
function isValidTeamAllocations(allocations: TeamAllocation[]): allocations is TeamAllocation[] {
  return Array.isArray(allocations) && allocations.every(isValidTeamAllocation);
}

// GET /api/graph/feature/[id] - Get a feature node by ID
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting FeatureNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Use the neo4jStorage to get the node
    const rawNode = await featureService.getNode(id);
    
    if (!rawNode) {
      console.warn('[API] FeatureNode not found:', id);
      return NextResponse.json(
        { error: 'FeatureNode not found' },
        { status: 404 }
      );
    }

    // Transform the node to properly parse JSON strings
    const node = neo4jToReactFlow(rawNode.data as unknown as Neo4jFeatureNodeData);

    // Ensure ID is explicitly set
    node.id = id;

    // Set position if it's missing
    if (!node.position || (node.position.x === undefined && node.position.y === undefined)) {
      node.position = {
        x: rawNode.position?.x || 0,
        y: rawNode.position?.y || 0
      };
    }
    
    // Ensure teamAllocations is always a valid array
    if (!Array.isArray(node.data.teamAllocations)) {
      console.warn('[API] teamAllocations is not an array, fixing...');
      
      // First try to parse if it's a string
      if (typeof node.data.teamAllocations === 'string') {
        try {
          node.data.teamAllocations = JSON.parse(node.data.teamAllocations);
        } catch (e) {
          console.error('[API] Failed to parse teamAllocations string:', e);
          node.data.teamAllocations = [];
        }
      } else {
        // If it's neither an array nor a string we can parse, set to empty array
        node.data.teamAllocations = [];
      }
    }
    
    // Validate each allocation object in the array
    if (Array.isArray(node.data.teamAllocations)) {
      // Filter out invalid allocations
      node.data.teamAllocations = node.data.teamAllocations.filter(allocation => {
        return allocation && 
               typeof allocation === 'object' && 
               typeof allocation.teamId === 'string' &&
               Array.isArray(allocation.allocatedMembers);
      });
    }

    // Only log metadata about the arrays instead of their full content
    console.log('[API] Successfully retrieved FeatureNode:', {
      id: node.id,
      type: node.type,
      data: {
        title: node.data.title,
        description: node.data.description,
        buildType: node.data.buildType,
        duration: node.data.duration,
        timeUnit: node.data.timeUnit,
        status: node.data.status,
        // Only log array lengths for logging purposes
        teamMembers: Array.isArray(node.data.teamMembers) ? 
          `${node.data.teamMembers.length} members` : 'not provided',
        memberAllocations: Array.isArray(node.data.memberAllocations) ? 
          `${node.data.memberAllocations.length} allocations` : 'not provided',
        teamAllocations: Array.isArray(node.data.teamAllocations) ? 
          `${node.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    // Return the transformed node with the complete data
    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error getting FeatureNode:', {
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
    }
    
    return NextResponse.json(
      { error: 'Failed to get FeatureNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/feature/[id] - Update a feature node by ID
export async function PATCH(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating FeatureNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updateData: UpdateFeatureNodeParams = await request.json();
    
    // Ensure the ID is included in the update params
    updateData.id = id;
    
    // Validate build type if provided
    if (updateData.buildType && !['internal', 'external'].includes(updateData.buildType)) {
      console.warn('[API] Invalid FeatureNode update request: Invalid buildType');
      return NextResponse.json(
        { error: 'Invalid buildType. Must be either "internal" or "external".' },
        { status: 400 }
      );
    }

    // Validate time unit if provided
    if (updateData.timeUnit && !['days', 'weeks'].includes(updateData.timeUnit)) {
      console.warn('[API] Invalid FeatureNode update request: Invalid timeUnit');
      return NextResponse.json(
        { error: 'Invalid timeUnit. Must be either "days" or "weeks".' },
        { status: 400 }
      );
    }

    // Validate member allocations if provided
    if (updateData.memberAllocations !== undefined && !isValidMemberAllocations(updateData.memberAllocations)) {
      console.warn('[API] Invalid FeatureNode update request: Invalid memberAllocations array');
      return NextResponse.json(
        { error: 'Invalid memberAllocations array. Each allocation must have memberId and timePercentage properties.' },
        { status: 400 }
      );
    }

    // Validate team allocations if provided
    if (updateData.teamAllocations !== undefined && !isValidTeamAllocations(updateData.teamAllocations)) {
      console.warn('[API] Invalid FeatureNode update request: Invalid teamAllocations array');
      return NextResponse.json(
        { error: 'Invalid teamAllocations array. Each allocation must have teamId, requestedHours, and allocatedMembers properties.' },
        { status: 400 }
      );
    }
    
    // Check if the node exists first
    const node = await featureService.getById(id);
    
    if (!node) {
      console.warn('[API] FeatureNode not found for update:', id);
      return NextResponse.json(
        { error: 'FeatureNode not found' },
        { status: 404 }
      );
    }

    console.log('[API] Updating FeatureNode with data:', {
      id: updateData.id,
      position: updateData.position,
      title: updateData.title,
      description: updateData.description,
      buildType: updateData.buildType,
      duration: updateData.duration,
      timeUnit: updateData.timeUnit,
      status: updateData.status,
      startDate: updateData.startDate,
      endDate: updateData.endDate,
      teamMembers: updateData.teamMembers ? `${updateData.teamMembers.length} members` : 'not provided',
      memberAllocations: updateData.memberAllocations ? `${updateData.memberAllocations.length} allocations` : 'not provided',
      teamAllocations: updateData.teamAllocations ? `${updateData.teamAllocations.length} allocations` : 'not provided'
    });

    // Use the featureService to update the node
    const updatedNode = await featureService.update(updateData);
    
    // Ensure complex objects are properly parsed
    if (typeof updatedNode.data.teamMembers === 'string') {
      try {
        updatedNode.data.teamMembers = JSON.parse(updatedNode.data.teamMembers);
      } catch {
        updatedNode.data.teamMembers = [];
      }
    }
    
    if (typeof updatedNode.data.memberAllocations === 'string') {
      try {
        updatedNode.data.memberAllocations = JSON.parse(updatedNode.data.memberAllocations);
      } catch {
        updatedNode.data.memberAllocations = [];
      }
    }
    
    if (typeof updatedNode.data.teamAllocations === 'string') {
      try {
        updatedNode.data.teamAllocations = JSON.parse(updatedNode.data.teamAllocations);
      } catch {
        updatedNode.data.teamAllocations = [];
      }
    }
    
    // Ensure teamAllocations is always a valid array
    if (!Array.isArray(updatedNode.data.teamAllocations)) {
      console.warn('[API] PATCH: teamAllocations is not an array after parsing, fixing...');
      updatedNode.data.teamAllocations = [];
    }
    
    // Validate each allocation object in the array
    if (Array.isArray(updatedNode.data.teamAllocations)) {
      // Filter out invalid allocations
      const beforeLength = updatedNode.data.teamAllocations.length;
      updatedNode.data.teamAllocations = updatedNode.data.teamAllocations.filter(allocation => {
        return allocation && 
               typeof allocation === 'object' && 
               typeof allocation.teamId === 'string' &&
               Array.isArray(allocation.allocatedMembers);
      });
      
      if (beforeLength !== updatedNode.data.teamAllocations.length) {
        console.warn(`[API] PATCH: Removed ${beforeLength - updatedNode.data.teamAllocations.length} invalid team allocations`);
      }
    }
    
    // Ensure ID is explicitly set
    updatedNode.id = id;
    
    // Only log metadata about the arrays instead of their full content
    console.log('[API] Successfully updated FeatureNode:', {
      id: updatedNode.id,
      type: updatedNode.type,
      data: {
        title: updatedNode.data.title,
        description: updatedNode.data.description,
        buildType: updatedNode.data.buildType,
        duration: updatedNode.data.duration,
        timeUnit: updatedNode.data.timeUnit,
        status: updatedNode.data.status,
        // Only log array lengths for logging purposes
        teamMembers: Array.isArray(updatedNode.data.teamMembers) ? 
          `${updatedNode.data.teamMembers.length} members` : 'not provided',
        memberAllocations: Array.isArray(updatedNode.data.memberAllocations) ? 
          `${updatedNode.data.memberAllocations.length} allocations` : 'not provided',
        teamAllocations: Array.isArray(updatedNode.data.teamAllocations) ? 
          `${updatedNode.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    // Return the updated node with the complete data
    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating FeatureNode:', {
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
    }
    
    return NextResponse.json(
      { error: 'Failed to update FeatureNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/feature/[id] - Delete a feature node by ID
export async function DELETE(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting FeatureNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if the node exists first
    const node = await featureService.getById(id);
    
    if (!node) {
      console.warn('[API] FeatureNode not found for deletion:', id);
      return NextResponse.json(
        { error: 'FeatureNode not found' },
        { status: 404 }
      );
    }

    // Use the featureService to delete the node
    await featureService.delete(id);
    
    console.log('[API] Successfully deleted FeatureNode:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting FeatureNode:', {
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
    }
    
    return NextResponse.json(
      { error: 'Failed to delete FeatureNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 