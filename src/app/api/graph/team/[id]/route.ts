import { NextRequest, NextResponse } from 'next/server';
import { teamService, neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateTeamNodeParams, Season, RosterMember, Neo4jTeamNodeData } from '@/services/graph/team/team.types';
import { neo4jToReactFlow } from '@/services/graph/team/team.transform';

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

// GET /api/graph/team/[id] - Get a team node by ID
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting TeamNode by ID:', id);
    
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
      console.warn('[API] TeamNode not found:', id);
      return NextResponse.json(
        { error: 'TeamNode not found' },
        { status: 404 }
      );
    }

    // Transform the node to properly parse JSON strings
    const node = neo4jToReactFlow(rawNode.data as unknown as Neo4jTeamNodeData);

    console.log('[API] Successfully retrieved TeamNode:', {
      id: node.id,
      type: node.type,
      data: {
        title: node.data.title,
        description: node.data.description,
        season: node.data.season,
        roster: node.data.roster
      }
    });

    // Return the transformed node
    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error getting TeamNode:', {
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
      { error: 'Failed to get TeamNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/team/[id] - Update a team node by ID
export async function PATCH(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating TeamNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updateData: UpdateTeamNodeParams = await request.json();
    
    // Ensure the ID is included in the update params
    updateData.id = id;
    
    // Validate season if provided
    if (updateData.season !== undefined && !isValidSeason(updateData.season)) {
      console.warn('[API] Invalid TeamNode update request: Invalid season object');
      return NextResponse.json(
        { error: 'Invalid season object. Season must have startDate, endDate, and name properties.' },
        { status: 400 }
      );
    }

    // Validate roster if provided
    if (updateData.roster !== undefined && !isValidRoster(updateData.roster)) {
      console.warn('[API] Invalid TeamNode update request: Invalid roster array');
      return NextResponse.json(
        { error: 'Invalid roster array. Each roster member must have memberId, allocation, and role properties.' },
        { status: 400 }
      );
    }
    
    // Check if the node exists first
    const node = await neo4jStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] TeamNode not found for update:', id);
      return NextResponse.json(
        { error: 'TeamNode not found' },
        { status: 404 }
      );
    }

    console.log('[API] Updating TeamNode with data:', {
      id: updateData.id,
      position: updateData.position,
      title: updateData.title,
      description: updateData.description,
      season: updateData.season ? 'provided' : 'not provided',
      roster: updateData.roster ? `${updateData.roster.length} members` : 'not provided'
    });

    // Use the teamService to update the node
    const updatedNode = await teamService.update(updateData);
    
    // Ensure the node has properly parsed roster and season
    if (typeof updatedNode.data.roster === 'string') {
      try {
        updatedNode.data.roster = JSON.parse(updatedNode.data.roster);
      } catch (e) {
        updatedNode.data.roster = [];
      }
    }
    
    if (typeof updatedNode.data.season === 'string') {
      try {
        updatedNode.data.season = JSON.parse(updatedNode.data.season);
      } catch (e) {
        updatedNode.data.season = undefined;
      }
    }
    
    console.log('[API] Successfully updated TeamNode:', {
      id: updatedNode.id,
      type: updatedNode.type,
      data: {
        title: updatedNode.data.title,
        description: updatedNode.data.description,
        season: updatedNode.data.season,
        roster: updatedNode.data.roster
      }
    });

    // Return the updated node
    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating TeamNode:', {
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
      { error: 'Failed to update TeamNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/team/[id] - Delete a team node by ID
export async function DELETE(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting TeamNode by ID:', id);
    
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
      console.warn('[API] TeamNode not found for deletion:', id);
      return NextResponse.json(
        { error: 'TeamNode not found' },
        { status: 404 }
      );
    }

    // Use the teamService to delete the node
    await teamService.delete(id);
    
    console.log('[API] Successfully deleted TeamNode:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting TeamNode:', {
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
      { error: 'Failed to delete TeamNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 