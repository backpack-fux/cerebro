import { NextRequest, NextResponse } from 'next/server';
import { teamMemberService } from '@/services/graph/neo4j/neo4j.provider';

// GET /api/graph/team-member/edges/[id] - Get a specific edge
export async function GET(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Getting TeamMemberEdge with ID: ${id}`);
    
    const edge = await teamMemberService.getEdge(id);
    
    if (!edge) {
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved TeamMemberEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting TeamMemberEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to get TeamMemberEdge' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/team-member/edges/[id] - Update a specific edge
export async function PATCH(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Updating TeamMemberEdge with ID: ${id}`);
    
    // Parse the request body
    const updateData = await req.json();
    
    console.log('[API] Received TeamMemberEdge update request:', {
      id,
      data: updateData,
    });
    
    const updatedEdge = await teamMemberService.updateEdge(id, updateData);
    
    if (!updatedEdge) {
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully updated TeamMemberEdge:', {
      id: updatedEdge.id,
      source: updatedEdge.source,
      target: updatedEdge.target,
      type: updatedEdge.type,
    });

    return NextResponse.json(updatedEdge);
  } catch (error) {
    console.error('[API] Error updating TeamMemberEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to update TeamMemberEdge' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/team-member/edges/[id] - Delete a specific edge
export async function DELETE(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Deleting TeamMemberEdge with ID: ${id}`);
    
    // The deleteEdge method returns void, so we need to handle errors differently
    try {
      await teamMemberService.deleteEdge(id);
      console.log(`[API] Successfully deleted TeamMemberEdge with ID: ${id}`);
      return new NextResponse(null, { status: 204 });
    } catch {
      // If an error is thrown, assume the edge wasn't found or couldn't be deleted
      return NextResponse.json(
        { error: 'Edge not found or could not be deleted' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('[API] Error deleting TeamMemberEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to delete TeamMemberEdge' },
      { status: 500 }
    );
  }
} 