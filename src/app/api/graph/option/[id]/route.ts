import { NextRequest, NextResponse } from 'next/server';
import { OptionService } from '@/services/graph/option/option.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateOptionNodeParams, Neo4jOptionNodeData, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
import { neo4jToReactFlow } from '@/services/graph/option/option.transform';

// Initialize the option service
const optionService = new OptionService(neo4jStorage);

/**
 * Validates a Goal object
 * @param goal The goal to validate
 * @returns True if valid, false otherwise
 */
function isValidGoal(goal: any): goal is Goal {
  return (
    goal &&
    typeof goal === 'object' &&
    typeof goal.id === 'string' &&
    typeof goal.name === 'string' &&
    typeof goal.description === 'string'
  );
}

/**
 * Validates an array of Goal objects
 * @param goals The goals array to validate
 * @returns True if valid, false otherwise
 */
function isValidGoals(goals: any): goals is Goal[] {
  return Array.isArray(goals) && goals.every(isValidGoal);
}

/**
 * Validates a Risk object
 * @param risk The risk to validate
 * @returns True if valid, false otherwise
 */
function isValidRisk(risk: any): risk is Risk {
  return (
    risk &&
    typeof risk === 'object' &&
    typeof risk.id === 'string' &&
    typeof risk.name === 'string' &&
    typeof risk.description === 'string' &&
    typeof risk.impact === 'string' &&
    typeof risk.likelihood === 'string'
  );
}

/**
 * Validates an array of Risk objects
 * @param risks The risks array to validate
 * @returns True if valid, false otherwise
 */
function isValidRisks(risks: any): risks is Risk[] {
  return Array.isArray(risks) && risks.every(isValidRisk);
}

/**
 * Validates a MemberAllocation object
 * @param allocation The member allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidMemberAllocation(allocation: any): allocation is MemberAllocation {
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
function isValidMemberAllocations(allocations: any): allocations is MemberAllocation[] {
  return Array.isArray(allocations) && allocations.every(isValidMemberAllocation);
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
  return Array.isArray(allocations) && allocations.every(isValidTeamAllocation);
}

// GET /api/graph/option/[id] - Get an option node by ID
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting OptionNode by ID:', id);
    
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
      console.warn('[API] OptionNode not found:', id);
      return NextResponse.json(
        { error: 'OptionNode not found' },
        { status: 404 }
      );
    }

    // Transform the node to properly parse JSON strings
    const node = neo4jToReactFlow(rawNode.data as unknown as Neo4jOptionNodeData);

    // Set position if it's missing
    if (!node.position || (node.position.x === undefined && node.position.y === undefined)) {
      node.position = {
        x: rawNode.position?.x || 0,
        y: rawNode.position?.y || 0
      };
    }

    // Ensure the ID is included in the response
    node.id = id;

    console.log('[API] Successfully retrieved OptionNode:', {
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        title: node.data.title,
        description: node.data.description,
        optionType: node.data.optionType,
        duration: node.data.duration,
        status: node.data.status,
        goals: Array.isArray(node.data.goals) ? `${node.data.goals.length} goals` : 'not provided',
        risks: Array.isArray(node.data.risks) ? `${node.data.risks.length} risks` : 'not provided',
        memberAllocations: Array.isArray(node.data.memberAllocations) ? `${node.data.memberAllocations.length} allocations` : 'not provided',
        teamAllocations: Array.isArray(node.data.teamAllocations) ? `${node.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    // Return the transformed node
    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error getting OptionNode:', {
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
      { error: 'Failed to get OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/option/[id] - Update an option node by ID
export async function PATCH(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating OptionNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updateData: UpdateOptionNodeParams = await request.json();
    
    // Ensure the ID is included in the update params
    updateData.id = id;
    
    // Validate optionType if provided
    if (updateData.optionType && !['customer', 'contract', 'partner'].includes(updateData.optionType)) {
      console.warn('[API] Invalid OptionNode update request: Invalid optionType');
      return NextResponse.json(
        { error: 'Invalid optionType. Must be one of: customer, contract, partner.' },
        { status: 400 }
      );
    }
    
    // Validate goals if provided
    if (updateData.goals !== undefined && !isValidGoals(updateData.goals)) {
      console.warn('[API] Invalid OptionNode update request: Invalid goals array');
      return NextResponse.json(
        { error: 'Invalid goals array. Each goal must have id, name, and description properties.' },
        { status: 400 }
      );
    }

    // Validate risks if provided
    if (updateData.risks !== undefined && !isValidRisks(updateData.risks)) {
      console.warn('[API] Invalid OptionNode update request: Invalid risks array');
      return NextResponse.json(
        { error: 'Invalid risks array. Each risk must have id, name, description, impact, and likelihood properties.' },
        { status: 400 }
      );
    }

    // Validate member allocations if provided
    if (updateData.memberAllocations !== undefined && !isValidMemberAllocations(updateData.memberAllocations)) {
      console.warn('[API] Invalid OptionNode update request: Invalid memberAllocations array');
      return NextResponse.json(
        { error: 'Invalid memberAllocations array. Each allocation must have memberId and timePercentage properties.' },
        { status: 400 }
      );
    }

    // Validate team allocations if provided
    if (updateData.teamAllocations !== undefined && !isValidTeamAllocations(updateData.teamAllocations)) {
      console.warn('[API] Invalid OptionNode update request: Invalid teamAllocations array');
      return NextResponse.json(
        { error: 'Invalid teamAllocations array. Each allocation must have teamId, requestedHours, and allocatedMembers properties.' },
        { status: 400 }
      );
    }
    
    // Check if the node exists first
    const node = await neo4jStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] OptionNode not found for update:', id);
      return NextResponse.json(
        { error: 'OptionNode not found' },
        { status: 404 }
      );
    }

    // Convert complex objects to JSON strings
    const cleanUpdateData: any = { ...updateData };
    if (cleanUpdateData.goals) {
      cleanUpdateData.goals = JSON.stringify(cleanUpdateData.goals);
    }
    if (cleanUpdateData.risks) {
      cleanUpdateData.risks = JSON.stringify(cleanUpdateData.risks);
    }
    if (cleanUpdateData.memberAllocations) {
      cleanUpdateData.memberAllocations = JSON.stringify(cleanUpdateData.memberAllocations);
    }
    if (cleanUpdateData.teamAllocations) {
      cleanUpdateData.teamAllocations = JSON.stringify(cleanUpdateData.teamAllocations);
    }
    if (cleanUpdateData.teamMembers) {
      cleanUpdateData.teamMembers = JSON.stringify(cleanUpdateData.teamMembers);
    }

    console.log('[API] Updating OptionNode with data:', {
      id: updateData.id,
      position: updateData.position,
      title: updateData.title,
      description: updateData.description,
      optionType: updateData.optionType,
      duration: updateData.duration,
      status: updateData.status,
      goals: updateData.goals ? `${updateData.goals.length} goals` : 'not provided',
      risks: updateData.risks ? `${updateData.risks.length} risks` : 'not provided',
      memberAllocations: updateData.memberAllocations ? `${updateData.memberAllocations.length} allocations` : 'not provided',
      teamAllocations: updateData.teamAllocations ? `${updateData.teamAllocations.length} allocations` : 'not provided'
    });

    // Use the optionService to update the node
    const updatedNode = await optionService.update(cleanUpdateData);
    
    // Ensure complex objects are properly parsed
    if (typeof updatedNode.data.goals === 'string') {
      try {
        updatedNode.data.goals = JSON.parse(updatedNode.data.goals);
      } catch (e) {
        updatedNode.data.goals = [];
      }
    }
    
    if (typeof updatedNode.data.risks === 'string') {
      try {
        updatedNode.data.risks = JSON.parse(updatedNode.data.risks);
      } catch (e) {
        updatedNode.data.risks = [];
      }
    }
    
    if (typeof updatedNode.data.memberAllocations === 'string') {
      try {
        updatedNode.data.memberAllocations = JSON.parse(updatedNode.data.memberAllocations);
      } catch (e) {
        updatedNode.data.memberAllocations = [];
      }
    }
    
    if (typeof updatedNode.data.teamAllocations === 'string') {
      try {
        updatedNode.data.teamAllocations = JSON.parse(updatedNode.data.teamAllocations);
      } catch (e) {
        updatedNode.data.teamAllocations = [];
      }
    }
    
    if (typeof updatedNode.data.teamMembers === 'string') {
      try {
        updatedNode.data.teamMembers = JSON.parse(updatedNode.data.teamMembers);
      } catch (e) {
        updatedNode.data.teamMembers = [];
      }
    }

    // Ensure the ID is included in the response
    updatedNode.id = id;

    console.log('[API] Successfully updated OptionNode:', {
      id: updatedNode.id,
      type: updatedNode.type,
      data: {
        title: updatedNode.data.title,
        description: updatedNode.data.description,
        optionType: updatedNode.data.optionType,
        duration: updatedNode.data.duration,
        status: updatedNode.data.status,
        goals: Array.isArray(updatedNode.data.goals) ? `${updatedNode.data.goals.length} goals` : 'not provided',
        risks: Array.isArray(updatedNode.data.risks) ? `${updatedNode.data.risks.length} risks` : 'not provided',
        memberAllocations: Array.isArray(updatedNode.data.memberAllocations) ? `${updatedNode.data.memberAllocations.length} allocations` : 'not provided',
        teamAllocations: Array.isArray(updatedNode.data.teamAllocations) ? `${updatedNode.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating OptionNode:', {
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
      { error: 'Failed to update OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/option/[id] - Delete an option node by ID
export async function DELETE(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting OptionNode by ID:', id);
    
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
      console.warn('[API] OptionNode not found for deletion:', id);
      return NextResponse.json(
        { error: 'OptionNode not found' },
        { status: 404 }
      );
    }

    // Use the optionService to delete the node
    await optionService.delete(id);

    console.log('[API] Successfully deleted OptionNode:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting OptionNode:', {
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
      { error: 'Failed to delete OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 