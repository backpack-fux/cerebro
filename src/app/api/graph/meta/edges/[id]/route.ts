import { NextRequest, NextResponse } from 'next/server';
import { metaService } from '@/services/graph/neo4j/neo4j.provider';
import { RFMetaEdge } from '@/services/graph/meta/meta.types';

interface Neo4jError {
  code: string;
  message: string;
}

// GET /api/graph/meta/edges/[id]
export async function GET(request: NextRequest) {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Getting MetaEdge:', id);
    
    if (!id) {
      console.warn('[API] Missing MetaEdge ID in request');
      return NextResponse.json(
        { error: 'MetaEdge ID is required' },
        { status: 400 }
      );
    }
    
    const edge = await metaService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] MetaEdge not found:', id);
      return NextResponse.json(
        { error: 'MetaEdge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Successfully retrieved MetaEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting MetaEdge:', {
      id: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get MetaEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/meta/edges/[id]
export async function PATCH(request: NextRequest) {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Updating MetaEdge:', id);
    
    if (!id) {
      console.warn('[API] Missing MetaEdge ID in request');
      return NextResponse.json(
        { error: 'MetaEdge ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate the edge using type guard
    if (!isValidRFMetaEdge(body)) {
      console.warn('[API] Invalid MetaEdge update request: Invalid parameters');
      return NextResponse.json(
        { error: 'Invalid parameters: id, source, target, and type are required' },
        { status: 400 }
      );
    }
    
    // Only pass the data properties to updateEdge
    const edge = await metaService.updateEdge(id, body.data || {});
    
    if (!edge) {
      console.warn('[API] MetaEdge not found:', id);
      return NextResponse.json(
        { error: 'MetaEdge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Successfully updated MetaEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error updating MetaEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update MetaEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/meta/edges/[id]
export async function DELETE(request: NextRequest) {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log('[API] Deleting MetaEdge:', id);
    
    if (!id) {
      console.warn('[API] Missing MetaEdge ID in request');
      return NextResponse.json(
        { error: 'MetaEdge ID is required' },
        { status: 400 }
      );
    }
    
    await metaService.deleteEdge(id);
    console.log('[API] Successfully deleted MetaEdge:', id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting MetaEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete MetaEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Validates an RFMetaEdge object
 * @param edge The edge to validate
 * @returns True if valid, false otherwise
 */
function isValidRFMetaEdge(edge: unknown): edge is RFMetaEdge {
  if (!edge || typeof edge !== 'object') return false;
  
  const e = edge as Partial<RFMetaEdge>;
  return (
    typeof e.id === 'string' &&
    typeof e.source === 'string' &&
    typeof e.target === 'string' &&
    typeof e.type === 'string' &&
    (!e.data || typeof e.data === 'object')
  );
} 