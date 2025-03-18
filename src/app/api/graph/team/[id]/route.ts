import { NextRequest, NextResponse } from 'next/server';
import { teamService, neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateTeamNodeParams, Season, RosterMember, Neo4jTeamNodeData } from '@/services/graph/team/team.types';
import { neo4jToReactFlow } from '@/services/graph/team/team.transform';

interface Neo4jErrorResponse {
  code: string;
  message: string;
}

/**
 * Validates a Season object
 * @param season The season object to validate
 * @returns True if valid, false otherwise
 */
function isValidSeason(season: unknown): season is Season {
  if (!season || typeof season !== 'object') return false;
  
  const typedSeason = season as Partial<Season>;
  return (
    typeof typedSeason.startDate === 'string' &&
    typeof typedSeason.endDate === 'string' &&
    typeof typedSeason.name === 'string' &&
    (!typedSeason.goals || Array.isArray(typedSeason.goals))
  );
}

/**
 * Validates a RosterMember object
 * @param member The roster member to validate
 * @returns True if valid, false otherwise
 */
function isValidRosterMember(member: unknown): member is RosterMember {
  if (!member || typeof member !== 'object') return false;
  
  const typedMember = member as Partial<RosterMember>;
  console.log('[API] Validating roster member:', typedMember);
  console.log('[API] Member properties:', {
    isMember: !!typedMember,
    isObject: typeof typedMember === 'object',
    hasMemberId: typeof typedMember.memberId === 'string',
    hasAllocation: typeof typedMember.allocation === 'number',
    hasRole: typeof typedMember.role === 'string',
    roleValue: typedMember.role
  });
  
  // Ensure role is a string (case-insensitive)
  const role = typedMember.role;
  const isValidRole = typeof role === 'string';
  
  return (
    typeof typedMember.memberId === 'string' &&
    typeof typedMember.allocation === 'number' &&
    isValidRole &&
    // Optional fields should be of the correct type if present
    (typedMember.startDate === undefined || typeof typedMember.startDate === 'string') &&
    (typedMember.endDate === undefined || typeof typedMember.endDate === 'string') &&
    (typedMember.allocations === undefined || Array.isArray(typedMember.allocations))
  );
}

/**
 * Validates an array of RosterMember objects
 * @param roster The roster array to validate
 * @returns True if valid, false otherwise
 */
function isValidRoster(roster: unknown): roster is RosterMember[] {
  console.log('[API] Validating roster:', roster);
  
  // If roster is a string, try to parse it as JSON
  let rosterArray = roster;
  if (typeof roster === 'string') {
    try {
      rosterArray = JSON.parse(roster);
      console.log('[API] Parsed roster string into array:', rosterArray);
    } catch {
      console.error('[API] Error parsing roster string');
      return false;
    }
  }
  
  console.log('[API] Roster properties:', {
    isArray: Array.isArray(rosterArray),
    length: Array.isArray(rosterArray) ? rosterArray.length : 'not an array'
  });
  
  if (!Array.isArray(rosterArray)) {
    console.log('[API] Roster is not an array');
    return false;
  }
  
  // Check each member
  const validMembers = rosterArray.map(isValidRosterMember);
  console.log('[API] Valid members:', validMembers);
  
  return validMembers.every(Boolean);
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
      const neo4jError = error as Neo4jErrorResponse;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
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
    console.log('[API] Received update data:', JSON.stringify(updateData));
    
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
    if (updateData.roster !== undefined) {
      console.log('[API] Roster provided for validation:', JSON.stringify(updateData.roster));
      
      // If roster is a string, try to parse it
      if (typeof updateData.roster === 'string') {
        try {
          updateData.roster = JSON.parse(updateData.roster);
          console.log('[API] Parsed roster string into array:', updateData.roster);
        } catch {
          console.error('[API] Error parsing roster string');
          return NextResponse.json(
            { error: 'Invalid roster format. Roster must be a valid JSON array.' },
            { status: 400 }
          );
        }
      }
      
      // Ensure roster is an array
      if (!Array.isArray(updateData.roster)) {
        console.warn('[API] Invalid roster format, expected array');
        return NextResponse.json(
          { error: 'Invalid roster format. Roster must be an array.' },
          { status: 400 }
        );
      }
      
      // Validate each roster member
      if (!isValidRoster(updateData.roster)) {
        console.warn('[API] Invalid TeamNode update request: Invalid roster array');
        return NextResponse.json(
          { error: 'Invalid roster array. Each roster member must have memberId, allocation, and role properties.' },
          { status: 400 }
        );
      }
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
      roster: updateData.roster ? `${Array.isArray(updateData.roster) ? updateData.roster.length : 'unknown'} members` : 'not provided'
    });

    // Use the teamService to update the node
    const updatedNode = await teamService.update(updateData);
    
    // Ensure complex objects are properly parsed
    if (typeof updatedNode.data.season === 'string') {
      try {
        updatedNode.data.season = JSON.parse(updatedNode.data.season);
      } catch {
        updatedNode.data.season = undefined;
      }
    }
    
    if (typeof updatedNode.data.roster === 'string') {
      try {
        updatedNode.data.roster = JSON.parse(updatedNode.data.roster);
      } catch {
        updatedNode.data.roster = [];
      }
    }

    console.log('[API] Successfully updated TeamNode:', {
      id: updatedNode.id,
      type: updatedNode.type,
      data: {
        title: updatedNode.data.title,
        description: updatedNode.data.description,
        season: updatedNode.data.season ? 'provided' : 'not provided',
        roster: Array.isArray(updatedNode.data.roster) ? `${updatedNode.data.roster.length} members` : 'not provided'
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
      const neo4jError = error as Neo4jErrorResponse;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
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

    try {
      // Use the teamService to delete the node
      await teamService.delete(id);
      console.log('[API] Successfully deleted TeamNode:', id);
    } catch (deleteError) {
      console.error('[API] Error using teamService.delete:', deleteError);
      
      // If edge retrieval failed but we still want to delete the node directly
      console.log('[API] Attempting direct node deletion as fallback');
      await neo4jStorage.deleteNode(id);
      console.log('[API] Successfully deleted TeamNode via direct storage call:', id);
    }

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
      const neo4jError = error as Neo4jErrorResponse;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete TeamNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 