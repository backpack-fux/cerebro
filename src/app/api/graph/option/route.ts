import { NextRequest, NextResponse } from 'next/server';
import { optionService } from '@/services/graph/neo4j/neo4j.provider';
import { 
  Goal, 
  Risk, 
  MemberAllocation, 
  TeamAllocation,
  ImpactLevel,
  SeverityLevel,
  CreateOptionNodeParams,
  OptionType
} from '@/services/graph/option/option.types';

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

// POST /api/graph/option - Create a new option node
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting OptionNode creation');
    const requestBody = await req.json();
    
    console.log('[API] OptionNode creation request body:', JSON.stringify(requestBody));
    
    // Handle both formats: nested data object or direct properties
    let nodeData: Partial<CreateOptionNodeParams> & {
      goals?: Goal[];
      risks?: Risk[];
      memberAllocations?: MemberAllocation[];
      teamAllocations?: TeamAllocation[];
      positionX?: number;
      positionY?: number;
    };
    
    let position: { x: number, y: number } = { x: 0, y: 0 };
    
    if ('data' in requestBody && typeof requestBody.data === 'object') {
      // Format: { data: { title, positionX, positionY, ... } }
      nodeData = requestBody.data;
    } else if ('title' in requestBody) {
      // Format: { title, position, ... } - direct properties
      nodeData = requestBody;
      
      // Handle position differently in this format
      if ('position' in requestBody && typeof requestBody.position === 'object') {
        position = requestBody.position;
        // Add positionX and positionY for compatibility
        nodeData.positionX = position.x;
        nodeData.positionY = position.y;
      }
    } else {
      console.warn('[API] Invalid OptionNode creation request: Invalid request body');
      return NextResponse.json(
        { error: 'Invalid request body', details: 'Request must include title and position data' },
        { status: 400 }
      );
    }
    
    // Remove any complex objects from the params
    // These will be handled by the service after node creation
    const { goals, risks, memberAllocations, teamAllocations, ...createParams } = nodeData;
    
    // Check for required fields in either format
    if (!createParams.title || 
        ((!createParams.positionX || !createParams.positionY) && 
         (!position || typeof position.x !== 'number' || typeof position.y !== 'number'))) {
      console.warn('[API] Invalid OptionNode creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields', details: 'Title and position are required' },
        { status: 400 }
      );
    }

    // Validate optionType if provided
    if (createParams.optionType && !['customer', 'contract', 'partner'].includes(createParams.optionType)) {
      console.warn('[API] Invalid OptionNode creation request: Invalid optionType');
      return NextResponse.json(
        { error: 'Invalid optionType', details: 'Must be one of: customer, contract, partner' },
        { status: 400 }
      );
    }

    // Convert Neo4j position format to React Flow format
    const finalPosition = {
      x: createParams.positionX || position.x,
      y: createParams.positionY || position.y
    };

    // Create params for the service
    const serviceParams: CreateOptionNodeParams = {
      title: createParams.title,
      description: createParams.description,
      optionType: createParams.optionType as OptionType | undefined,
      duration: createParams.duration,
      status: createParams.status,
      position: finalPosition
    };

    console.log('[API] Creating option node with params:', JSON.stringify(serviceParams));

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
    const node = await optionService.getById(createdNode.id);
    
    if (!node) {
      console.error('[API] Failed to retrieve created option node:', createdNode.id);
      return NextResponse.json(
        { error: 'Failed to retrieve created node', details: 'Database query returned null' },
        { status: 500 }
      );
    }
    
    // Ensure the ID is explicitly set in the response
    node.id = createdNode.id;
    
    console.log('[API] Successfully created OptionNode:', {
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

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating OptionNode:', {
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
      { error: 'Failed to create OptionNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 