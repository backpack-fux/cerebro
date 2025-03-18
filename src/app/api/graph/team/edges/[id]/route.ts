import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/services/graph/neo4j/neo4j.provider';
import { RFTeamEdge } from '@/services/graph/team/team.types';

interface Neo4jErrorResponse {
  code: string;
  message: string;
}

/**
 * Validates edge update data
 * @param data The data to validate
 * @returns True if valid, false otherwise
 */
function isValidEdgeUpdate(data: unknown): data is Partial<RFTeamEdge['data']> {
  if (!data || typeof data !== 'object') return false;
  
  const typedData = data as Record<string, unknown>;
  
  // Check if any of the optional fields are present and of the correct type
  return (
    (typedData.label === undefined || typeof typedData.label === 'string') &&
    (typedData.edgeType === undefined || typeof typedData.edgeType === 'string') &&
    (typedData.allocation === undefined || typeof typedData.allocation === 'number')
  );
}

// GET /api/graph/team/edges/[id] - Get a specific edge
export async function GET(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Getting TeamEdge with ID:', id);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    const edge = await teamService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] TeamEdge not found:', id);
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved TeamEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting TeamEdge:', {
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
      { error: 'Failed to get TeamEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/team/edges/[id] - Update a specific edge
export async function PATCH(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Updating TeamEdge with ID:', id);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    let updates;
    try {
      updates = await req.json();
    } catch {
      console.warn('[API] Invalid JSON in request body');
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Validate the update data
    if (!isValidEdgeUpdate(updates)) {
      console.warn('[API] Invalid edge update data:', updates);
      return NextResponse.json(
        { error: 'Invalid edge update data. Updates must include valid label, edgeType, or allocation values.' },
        { status: 400 }
      );
    }
    
    // Check if the edge exists before updating
    const existingEdge = await teamService.getEdge(id);
    if (!existingEdge) {
      console.warn('[API] TeamEdge not found for update:', id);
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      );
    }
    
    const edge = await teamService.updateEdge(id, updates);
    
    console.log('[API] Successfully updated TeamEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error updating TeamEdge:', {
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
      { error: 'Failed to update TeamEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/team/edges/[id] - Delete a specific edge
export async function DELETE(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Deleting TeamEdge with ID:', id);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    // Check if the edge exists before deleting
    const existingEdge = await teamService.getEdge(id);
    if (!existingEdge) {
      console.warn('[API] TeamEdge not found for deletion:', id);
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      );
    }
    
    await teamService.deleteEdge(id);
    
    console.log('[API] Successfully deleted TeamEdge:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting TeamEdge:', {
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
      { error: 'Failed to delete TeamEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 