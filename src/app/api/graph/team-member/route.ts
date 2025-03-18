import { NextRequest, NextResponse } from 'next/server';
import { teamMemberService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateTeamMemberNodeParams } from '@/services/graph/team-member/team-member.types';

// POST /api/graph/team-member - Create a new team member node
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting TeamMember creation');
    
    // Parse the request body
    const body = await req.json();
    
    // Validate required fields
    if (!body.title || !body.position) {
      console.warn('[API] Invalid TeamMember creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title and position are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received TeamMember creation request:', {
      title: body.title,
      position: body.position,
      data: body.data,
    });

    // Create params object with the correct structure
    const createParams: CreateTeamMemberNodeParams = {
      title: body.title,
      position: body.position,
      bio: body.bio,
      roles: body.roles,
      timezone: body.timezone,
      dailyRate: body.dailyRate,
      hoursPerDay: body.hoursPerDay,
      daysPerWeek: body.daysPerWeek,
      startDate: body.startDate,
      skills: body.skills
    };

    // Use TeamMemberService to create the node
    const createdNode = await teamMemberService.create(createParams);
    
    console.log('[API] Successfully created TeamMember:', {
      id: createdNode.id,
      title: createdNode.data.title,
      position: createdNode.position,
    });

    // Return the created node
    return NextResponse.json(createdNode, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating TeamMember:', error);
    
    return NextResponse.json(
      { error: 'Failed to create TeamMember' },
      { status: 500 }
    );
  }
}

// GET /api/graph/team-member - Get all team member nodes
export async function GET() {
  try {
    console.log('[API] Getting all TeamMembers');
    
    const nodes = await teamMemberService.getAll();
    
    console.log(`[API] Successfully retrieved ${nodes.length} TeamMembers`);
    
    return NextResponse.json(nodes);
  } catch (error) {
    console.error('[API] Error getting TeamMembers:', error);
    
    return NextResponse.json(
      { error: 'Failed to get TeamMembers' },
      { status: 500 }
    );
  }
} 