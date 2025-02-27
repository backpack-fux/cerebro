import { NextRequest, NextResponse } from 'next/server';
import { OptionService } from '@/services/graph/option/option.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { CreateOptionNodeParams, RFOptionNode, Neo4jOptionNodeData, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
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

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting OptionNode creation');
    const params: CreateOptionNodeParams = await req.json();
    
    // Remove any complex objects from the params
    // These will be handled by the service after node creation
    const { goals, risks, memberAllocations, teamAllocations, ...createParams } = params as any;
    
    if (!createParams.title || !createParams.position) {
      console.warn('[API] Invalid OptionNode creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title and position are required' },
        { status: 400 }
      );
    }

    // Validate optionType if provided
    if (createParams.optionType && !['customer', 'contract', 'partner'].includes(createParams.optionType)) {
      console.warn('[API] Invalid OptionNode creation request: Invalid optionType');
      return NextResponse.json(
        { error: 'Invalid optionType. Must be one of: customer, contract, partner.' },
        { status: 400 }
      );
    }

    console.log('[API] Received OptionNode creation request:', {
      title: createParams.title,
      description: createParams.description,
      position: createParams.position,
      optionType: createParams.optionType,
      duration: createParams.duration,
      status: createParams.status
    });

    // Create the option node
    const createdNode = await optionService.create(createParams);
    
    // If goals were provided, add them to the node
    if (goals && isValidGoals(goals)) {
      console.log('[API] Adding goals to option node:', goals);
      await optionService.update({
        id: createdNode.id,
        goals
      });
    }
    
    // If risks were provided, add them to the node
    if (risks && isValidRisks(risks)) {
      console.log('[API] Adding risks to option node:', risks);
      await optionService.update({
        id: createdNode.id,
        risks
      });
    }
    
    // If memberAllocations were provided, add them to the node
    if (memberAllocations && isValidMemberAllocations(memberAllocations)) {
      console.log('[API] Adding member allocations to option node:', memberAllocations);
      await optionService.update({
        id: createdNode.id,
        memberAllocations
      });
    }
    
    // If teamAllocations were provided, add them to the node
    if (teamAllocations && isValidTeamAllocations(teamAllocations)) {
      console.log('[API] Adding team allocations to option node:', teamAllocations);
      await optionService.update({
        id: createdNode.id,
        teamAllocations
      });
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
    const transformedNode = neo4jToReactFlow(node.data as unknown as Neo4jOptionNodeData);
    
    // Ensure the ID is included in the response
    transformedNode.id = createdNode.id;
    
    console.log('[API] Successfully created OptionNode:', {
      id: transformedNode.id,
      type: transformedNode.type,
      position: transformedNode.position,
      data: {
        title: transformedNode.data.title,
        description: transformedNode.data.description,
        optionType: transformedNode.data.optionType,
        duration: transformedNode.data.duration,
        status: transformedNode.data.status,
        goals: Array.isArray(transformedNode.data.goals) ? `${transformedNode.data.goals.length} goals` : 'not provided',
        risks: Array.isArray(transformedNode.data.risks) ? `${transformedNode.data.risks.length} risks` : 'not provided',
        memberAllocations: Array.isArray(transformedNode.data.memberAllocations) ? `${transformedNode.data.memberAllocations.length} allocations` : 'not provided',
        teamAllocations: Array.isArray(transformedNode.data.teamAllocations) ? `${transformedNode.data.teamAllocations.length} allocations` : 'not provided'
      }
    });

    return NextResponse.json(transformedNode, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating OptionNode:', {
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
      { error: 'Failed to create OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 