import { NextRequest, NextResponse } from 'next/server';
import { metaService } from '@/services/graph/neo4j/neo4j.provider';

// GET /api/graph/meta/edges/[id] - Get a specific edge
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Getting MetaEdge with ID: ${id}`);
    
    const edge = await metaService.getEdge(id);
    
    if (!edge) {
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved MetaEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting MetaEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to get MetaEdge' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/meta/edges/[id] - Update a specific edge
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Updating MetaEdge with ID: ${id}`);
    
    const updates = await req.json();
    
    const edge = await metaService.updateEdge(id, updates);
    
    console.log('[API] Successfully updated MetaEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error updating MetaEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to update MetaEdge' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/meta/edges/[id] - Delete a specific edge
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Deleting MetaEdge with ID: ${id}`);
    
    await metaService.deleteEdge(id);
    
    console.log(`[API] Successfully deleted MetaEdge with ID: ${id}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[API] Error deleting MetaEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to delete MetaEdge' },
      { status: 500 }
    );
  }
} 