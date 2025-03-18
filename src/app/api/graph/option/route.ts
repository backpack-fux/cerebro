import { NextRequest, NextResponse } from 'next/server';
import { createOptionStorage, createOptionService } from '@/services/graph/neo4j/neo4j.provider';
import { 
  Neo4jOptionNodeData, 
  Goal, 
  Risk, 
  MemberAllocation, 
  TeamAllocation,
  ImpactLevel,
  SeverityLevel,
  CreateOptionNodeParams,
  OptionType
} from '@/services/graph/option/option.types';
import { neo4jToReactFlow } from '@/services/graph/option/option.transform';

// Initialize the option service with the correct storage type
const optionStorage = createOptionStorage();
const optionService = createOptionService(optionStorage);

interface CreateNodeBody {
  type: string;
  data: Neo4jOptionNodeData;
  position: { x: number; y: number };
}

interface Neo4jError {
  code: string;
  message: string;
}

/**
 * Validates a Goal object
 * @param goal The goal to validate
 * @returns True if valid, false otherwise
 */
function isValidGoal(goal: unknown): goal is Goal {
  if (!goal || typeof goal !== 'object') return false;
  
  const g = goal as Partial<Goal>;
  return (
    typeof g.id === 'string' &&
    typeof g.description === 'string' &&
    typeof g.impact === 'string' &&
    ['high', 'medium', 'low'].includes(g.impact as ImpactLevel)
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
  
  const r = risk as Partial<Risk>;
  return (
    typeof r.id === 'string' &&
    typeof r.description === 'string' &&
    typeof r.severity === 'string' &&
    ['high', 'medium', 'low'].includes(r.severity as SeverityLevel) &&
    (r.mitigation === undefined || typeof r.mitigation === 'string')
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
  
  const a = allocation as Partial<MemberAllocation>;
  return (
    typeof a.memberId === 'string' &&
    typeof a.timePercentage === 'number'
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

/**
 * Validates a TeamAllocation object
 * @param allocation The team allocation to validate
 * @returns True if valid, false otherwise
 */
function isValidTeamAllocation(allocation: unknown): allocation is TeamAllocation {
  if (!allocation || typeof allocation !== 'object' || !('allocatedMembers' in allocation)) {
    return false;
  }

  const a = allocation as Partial<TeamAllocation>;
  const allocatedMembers = a.allocatedMembers;

  return (
    typeof a.teamId === 'string' &&
    typeof a.requestedHours === 'number' &&
    Array.isArray(allocatedMembers) &&
    allocatedMembers.every((member): member is { memberId: string; hours: number } => 
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
function isValidTeamAllocations(allocations: unknown): allocations is TeamAllocation[] {
  return Array.isArray(allocations) && allocations.every(isValidTeamAllocation);
}

// POST /api/graph/meta/edges - Create a new edge between meta nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting OptionNode creation');
    const requestBody = await req.json();
    
    // Type check the request body
    if (!requestBody || typeof requestBody !== 'object' || !('data' in requestBody)) {
      console.warn('[API] Invalid OptionNode creation request: Invalid request body');
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const body = requestBody as CreateNodeBody;
    
    // Remove any complex objects from the params
    // These will be handled by the service after node creation
    const { goals, risks, memberAllocations, teamAllocations, ...createParams } = body.data;
    
    if (!createParams.title || !createParams.positionX || !createParams.positionY) {
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

    // Convert Neo4j position format to React Flow format
    const position = {
      x: createParams.positionX,
      y: createParams.positionY
    };

    // Create params for the service
    const serviceParams: CreateOptionNodeParams = {
      title: createParams.title,
      description: createParams.description,
      optionType: createParams.optionType as OptionType | undefined,
      duration: createParams.duration,
      status: createParams.status,
      position
    };

    // Create the option node
    const createdNode = await optionService.create(serviceParams);
    
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
    const node = await optionStorage.getNode(createdNode.id);
    
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
      const neo4jError = error as Neo4jError;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const requestBody = await req.json();
    
    // Type check the request body
    if (!requestBody || typeof requestBody !== 'object' || !('id' in requestBody)) {
      console.warn('[API] Invalid OptionNode update request: Invalid request body');
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { id, ...updateData } = requestBody;
    
    // Check if the node exists first
    const node = await optionStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] OptionNode not found for update:', id);
      return NextResponse.json(
        { error: 'OptionNode not found' },
        { status: 404 }
      );
    }

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
        { error: 'Invalid goals array. Each goal must have id, description, and impact properties.' },
        { status: 400 }
      );
    }

    // Validate risks if provided
    if (updateData.risks !== undefined && !isValidRisks(updateData.risks)) {
      console.warn('[API] Invalid OptionNode update request: Invalid risks array');
      return NextResponse.json(
        { error: 'Invalid risks array. Each risk must have id, description, and severity properties.' },
        { status: 400 }
      );
    }

    // Validate memberAllocations if provided
    if (updateData.memberAllocations !== undefined && !isValidMemberAllocations(updateData.memberAllocations)) {
      console.warn('[API] Invalid OptionNode update request: Invalid memberAllocations array');
      return NextResponse.json(
        { error: 'Invalid memberAllocations array. Each allocation must have memberId and timePercentage properties.' },
        { status: 400 }
      );
    }

    // Validate teamAllocations if provided
    if (updateData.teamAllocations !== undefined && !isValidTeamAllocations(updateData.teamAllocations)) {
      console.warn('[API] Invalid OptionNode update request: Invalid teamAllocations array');
      return NextResponse.json(
        { error: 'Invalid teamAllocations array. Each allocation must have teamId, requestedHours, and allocatedMembers properties.' },
        { status: 400 }
      );
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

    // Update the option node
    const updatedNode = await optionService.update({
      id,
      ...updateData
    });

    // Ensure complex objects are properly parsed
    if (typeof updatedNode.data.goals === 'string') {
      try {
        updatedNode.data.goals = JSON.parse(updatedNode.data.goals);
      } catch {
        updatedNode.data.goals = [];
      }
    }
    
    if (typeof updatedNode.data.risks === 'string') {
      try {
        updatedNode.data.risks = JSON.parse(updatedNode.data.risks);
      } catch {
        updatedNode.data.risks = [];
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
    
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as Neo4jError;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 