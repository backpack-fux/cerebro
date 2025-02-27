// app/api/graph/team/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TeamService } from '@/services/graph/team/team.service';
import { teamService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateTeamNodeParams, RFTeamNode, UpdateTeamNodeParams, RFTeamEdge, Season, RosterMember, Neo4jTeamNodeData } from '@/services/graph/team/team.types';
import { neo4jToReactFlow } from '@/services/graph/team/team.transform';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';

/**
 * Validates a Season object
 * @param season The season object to validate
 * @returns True if valid, false otherwise
 */
function isValidSeason(season: any): season is Season {
  return (
    season &&
    typeof season === 'object' &&
    typeof season.startDate === 'string' &&
    typeof season.endDate === 'string' &&
    typeof season.name === 'string' &&
    (!season.goals || Array.isArray(season.goals))
  );
}

/**
 * Validates a RosterMember object
 * @param member The roster member to validate
 * @returns True if valid, false otherwise
 */
function isValidRosterMember(member: any): member is RosterMember {
  return (
    member &&
    typeof member === 'object' &&
    typeof member.memberId === 'string' &&
    typeof member.allocation === 'number' &&
    typeof member.role === 'string'
  );
}

/**
 * Validates an array of RosterMember objects
 * @param roster The roster array to validate
 * @returns True if valid, false otherwise
 */
function isValidRoster(roster: any): roster is RosterMember[] {
  return Array.isArray(roster) && roster.every(isValidRosterMember);
}

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting TeamNode creation');
    const params: CreateTeamNodeParams = await req.json();
    if (!params.title || !params.position) {
      console.warn('[API] Invalid TeamNode creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title and position are required' },
        { status: 400 }
      );
    }

    // Validate season if provided
    if (params.season !== undefined && !isValidSeason(params.season)) {
      console.warn('[API] Invalid TeamNode creation request: Invalid season object');
      return NextResponse.json(
        { error: 'Invalid season object. Season must have startDate, endDate, and name properties.' },
        { status: 400 }
      );
    }

    // Validate roster if provided
    if (params.roster !== undefined && !isValidRoster(params.roster)) {
      console.warn('[API] Invalid TeamNode creation request: Invalid roster array');
      return NextResponse.json(
        { error: 'Invalid roster array. Each roster member must have memberId, allocation, and role properties.' },
        { status: 400 }
      );
    }

    console.log('[API] Received TeamNode creation request:', {
      title: params.title,
      description: params.description,
      position: params.position,
      season: params.season,
      roster: params.roster,
    });

    // The teamService.create method already uses the transformation functions
    const createdNode = await teamService.create(params);
    
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
    const transformedNode = neo4jToReactFlow(node.data as unknown as Neo4jTeamNodeData);
    
    // Ensure the ID is explicitly set in the response
    transformedNode.id = createdNode.id;
    
    console.log('[API] Successfully created TeamNode:', {
      id: transformedNode.id,
      type: transformedNode.type,
      position: transformedNode.position,
      data: {
        title: transformedNode.data.title,
        description: transformedNode.data.description,
        name: transformedNode.data.name,
        season: transformedNode.data.season ? 'provided' : 'not provided',
        roster: Array.isArray(transformedNode.data.roster) ? `${transformedNode.data.roster.length} members` : 'not provided',
      }
    });

    return NextResponse.json(transformedNode, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating TeamNode:', {
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
      { error: 'Failed to create TeamNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 