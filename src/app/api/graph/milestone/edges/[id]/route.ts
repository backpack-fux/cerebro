import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';

interface Neo4jError {
  code: string;
  message: string;
}

// GET /api/graph/milestone/edges/[id]
export async function GET(request: NextRequest) {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Getting milestone edge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }
    
    const edge = await milestoneService.getMilestoneEdge(id);
    
    if (!edge) {
      console.warn('[API] Milestone edge not found:', id);
      return NextResponse.json(
        { error: 'Milestone edge not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved milestone edge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });
    
    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting milestone edge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as Neo4jError;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get milestone edge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/milestone/edges/[id]
export async function PATCH(request: NextRequest) {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Updating milestone edge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }
    
    // Parse the request body
    const updateData = await request.json();
    
    // Check if the edge exists first
    const edge = await milestoneService.getMilestoneEdge(id);
    
    if (!edge) {
      console.warn('[API] Milestone edge not found for update:', id);
      return NextResponse.json(
        { error: 'Milestone edge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Updating milestone edge with data:', {
      id,
      properties: updateData
    });

    // Update the edge
    const updatedEdge = await milestoneService.updateMilestoneEdge(id, updateData);
    
    if (!updatedEdge) {
      console.warn('[API] Failed to update milestone edge:', id);
      return NextResponse.json(
        { error: 'Failed to update milestone edge' },
        { status: 500 }
      );
    }
    
    console.log('[API] Successfully updated milestone edge:', {
      id: updatedEdge.id,
      source: updatedEdge.source,
      target: updatedEdge.target,
      type: updatedEdge.type,
      data: updatedEdge.data
    });

    // Return the updated edge
    return NextResponse.json(updatedEdge);
  } catch (error) {
    console.error('[API] Error updating milestone edge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as Neo4jError;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update milestone edge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/milestone/edges/[id]
export async function DELETE(request: NextRequest) {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting milestone edge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if the edge exists first
    const edge = await milestoneService.getMilestoneEdge(id);
    
    if (!edge) {
      console.warn('[API] Milestone edge not found for deletion:', id);
      return NextResponse.json(
        { error: 'Milestone edge not found' },
        { status: 404 }
      );
    }

    // Delete the edge
    await milestoneService.deleteMilestoneEdge(id);
    
    console.log('[API] Successfully deleted milestone edge:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting milestone edge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as Neo4jError;
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete milestone edge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 