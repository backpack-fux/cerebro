import { NextRequest, NextResponse } from 'next/server';
import { createOptionStorage, createOptionService } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateOptionNodeParams, Neo4jOptionNodeData, Goal, Risk, MemberAllocation, TeamAllocation, ImpactLevel, SeverityLevel } from '@/services/graph/option/option.types';
import { neo4jToReactFlow } from '@/services/graph/option/option.transform';

interface Neo4jError {
  code: string;
  message: string;
}

// Initialize the option service with the correct storage type
const optionStorage = createOptionStorage();
const optionService = createOptionService(optionStorage);

/**
 * Validates a Goal object
 * @param goal The goal to validate
 * @returns True if valid, false otherwise
 */
function isValidGoal(goal: unknown): goal is Goal {
  if (!goal || typeof goal !== 'object') return false;
  
  const goalObj = goal as Partial<Goal>;
  return (
    typeof goalObj.id === 'string' &&
    typeof goalObj.description === 'string' &&
    typeof goalObj.impact === 'string' &&
    ['high', 'medium', 'low'].includes(goalObj.impact as ImpactLevel)
  );
}

/**
 * Validates an array of Goal objects
 * @param goals The goals array to validate
 * @returns True if valid, false otherwise
 */
function isValidGoals(goals: unknown): goals is Goal[] {
  return Array.isArray(goals) && goals.every(isValidGoal);
}

/**
 * Validates a Risk object
 * @param risk The risk to validate
 * @returns True if valid, false otherwise
 */
function isValidRisk(risk: unknown): risk is Risk {
  if (!risk || typeof risk !== 'object') return false;
  
  const riskObj = risk as Partial<Risk>;
  return (
    typeof riskObj.id === 'string' &&
    typeof riskObj.description === 'string' &&
    typeof riskObj.severity === 'string' &&
    ['high', 'medium', 'low'].includes(riskObj.severity as SeverityLevel) &&
    (riskObj.mitigation === undefined || typeof riskObj.mitigation === 'string')
  );
}

/**
 * Validates an array of Risk objects
 * @param risks The risks array to validate
 * @returns True if valid, false otherwise
 */
function isValidRisks(risks: unknown): risks is Risk[] {
  return Array.isArray(risks) && risks.every(isValidRisk);
}

/**
 * Validates a MemberAllocation object
 * @param allocation The member allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidMemberAllocation(allocation: unknown): allocation is MemberAllocation {
  if (!allocation || typeof allocation !== 'object') return false;
  
  const memberAlloc = allocation as Partial<MemberAllocation>;
  return (
    typeof memberAlloc.memberId === 'string' &&
    typeof memberAlloc.timePercentage === 'number'
  );
}

/**
 * Validates an array of MemberAllocation objects
 * @param allocations The allocations array to validate
 * @returns True if valid, false otherwise
 */
function isValidMemberAllocations(allocations: unknown): allocations is MemberAllocation[] {
  return Array.isArray(allocations) && allocations.every(isValidMemberAllocation);
}

interface AllocatedMember {
  memberId: string;
  name?: string;
  hours: number;
  availableHours?: number;
}

/**
 * Validates a TeamAllocation object
 * @param allocation The team allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocation(allocation: unknown): allocation is TeamAllocation {
  if (!allocation || typeof allocation !== 'object') return false;
  
  const teamAlloc = allocation as Partial<TeamAllocation>;
  if (!teamAlloc.teamId || !teamAlloc.requestedHours || !teamAlloc.allocatedMembers) return false;
  
  if (typeof teamAlloc.teamId !== 'string' || typeof teamAlloc.requestedHours !== 'number') return false;
  
  if (!Array.isArray(teamAlloc.allocatedMembers)) return false;
  
  return teamAlloc.allocatedMembers.every((member): member is AllocatedMember => 
    member !== null &&
    typeof member === 'object' &&
    typeof member.memberId === 'string' &&
    typeof member.hours === 'number' &&
    (member.name === undefined || typeof member.name === 'string') &&
    (member.availableHours === undefined || typeof member.availableHours === 'number')
  );
}

/**
 * Validates an array of TeamAllocation objects
 * @param allocations The allocations array to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocations(allocations: unknown): allocations is TeamAllocation[] {
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
    const rawNode = await optionStorage.getNode(id);
    
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
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
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

    // Use the optionService to update the node
    const updatedNode = await optionService.update(updateData);
    
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

    // Return the updated node
    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating OptionNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
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

    // Use the optionService to delete the node
    await optionService.delete(id);
    
    console.log('[API] Successfully deleted OptionNode:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting OptionNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 