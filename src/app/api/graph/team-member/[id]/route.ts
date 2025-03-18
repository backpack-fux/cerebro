import { NextRequest, NextResponse } from 'next/server';
import { teamMemberService } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateTeamMemberNodeParams } from '@/services/graph/team-member/team-member.types';

// GET /api/graph/team-member/[id] - Get a specific team member node
export async function GET(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Getting TeamMember with ID: ${id}`);
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing ID parameter' },
        { status: 400 }
      );
    }
    
    // Use get() instead of getById() which doesn't exist
    const node = await teamMemberService.get(id);
    
    if (!node) {
      return NextResponse.json(
        { error: 'TeamMember not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved TeamMember:', {
      id: node.id,
      title: node.data.title,
    });

    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error getting TeamMember:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to get TeamMember' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/team-member/[id] - Update a specific team member node
export async function PATCH(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Updating TeamMember with ID: ${id}`);
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing ID parameter' },
        { status: 400 }
      );
    }
    
    // Parse the request body
    const updateData = await req.json();
    
    console.log('[API] Received TeamMember update request:', {
      id,
      ...updateData,
    });
    
    // Combine id with update data to match the expected parameter structure
    const updateParams: UpdateTeamMemberNodeParams = {
      id,
      ...updateData
    };
    
    const updatedNode = await teamMemberService.update(updateParams);
    
    if (!updatedNode) {
      return NextResponse.json(
        { error: 'TeamMember not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully updated TeamMember:', {
      id: updatedNode.id,
      title: updatedNode.data.title,
    });

    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating TeamMember:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to update TeamMember' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/team-member/[id] - Delete a specific team member node
export async function DELETE(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Deleting TeamMember with ID: ${id}`);
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing ID parameter' },
        { status: 400 }
      );
    }
    
    // The delete method returns void, so we need to handle errors differently
    try {
      await teamMemberService.delete(id);
      console.log(`[API] Successfully deleted TeamMember with ID: ${id}`);
      return new NextResponse(null, { status: 204 });
    } catch {
      // If an error is thrown, assume the node wasn't found or couldn't be deleted
      return NextResponse.json(
        { error: 'TeamMember not found or could not be deleted' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('[API] Error deleting TeamMember:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to delete TeamMember' },
      { status: 500 }
    );
  }
} 