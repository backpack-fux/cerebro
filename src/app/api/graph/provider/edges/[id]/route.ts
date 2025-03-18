import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/services/graph/neo4j/neo4j.provider';

// GET /api/graph/provider/edges/[id] - Get a specific edge
export async function GET(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Getting ProviderEdge with ID: ${id}`);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    const edge = await providerService.getEdge(id);
    
    if (!edge) {
      console.warn(`[API] ProviderEdge with ID: ${id} not found`);
      return NextResponse.json(
        { error: `Edge with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved ProviderEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting ProviderEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to get ProviderEdge',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/provider/edges/[id] - Update a specific edge
export async function PATCH(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Updating ProviderEdge with ID: ${id}`);
    
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
    
    // Check if the edge exists before updating
    const existingEdge = await providerService.getEdge(id);
    if (!existingEdge) {
      console.warn(`[API] ProviderEdge with ID: ${id} not found for update`);
      return NextResponse.json(
        { error: `Edge with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    const edge = await providerService.updateEdge(id, updates);
    
    console.log('[API] Successfully updated ProviderEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error updating ProviderEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to update ProviderEdge',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/provider/edges/[id] - Delete a specific edge
export async function DELETE(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Deleting ProviderEdge with ID: ${id}`);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    // Check if the edge exists before deleting
    const existingEdge = await providerService.getEdge(id);
    if (!existingEdge) {
      console.warn(`[API] ProviderEdge with ID: ${id} not found for deletion`);
      return NextResponse.json(
        { error: `Edge with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    await providerService.deleteEdge(id);
    
    console.log(`[API] Successfully deleted ProviderEdge with ID: ${id}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[API] Error deleting ProviderEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to delete ProviderEdge',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 