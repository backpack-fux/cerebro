import { NextRequest, NextResponse } from 'next/server';
import { optionService } from '@/services/graph/neo4j/neo4j.provider';

// GET /api/graph/option/edges/[id] - Get a specific edge
export async function GET(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Getting OptionEdge with ID: ${id}`);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    const edge = await optionService.getEdge(id);
    
    if (!edge) {
      console.warn(`[API] OptionEdge with ID: ${id} not found`);
      return NextResponse.json(
        { error: `Edge with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    console.log('[API] Successfully retrieved OptionEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting OptionEdge:', error);
    return NextResponse.json({ error: 'Failed to get OptionEdge' }, { status: 500 });
  }
}

// PATCH /api/graph/option/edges/[id] - Update a specific edge
export async function PATCH(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Updating OptionEdge with ID: ${id}`);
    
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
    } catch (error) {
      console.warn('[API] Invalid JSON in request body:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Check if the edge exists before updating
    const existingEdge = await optionService.getEdge(id);
    if (!existingEdge) {
      console.warn(`[API] OptionEdge with ID: ${id} not found for update`);
      return NextResponse.json(
        { error: `Edge with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    const edge = await optionService.updateEdge(id, updates);
    
    console.log('[API] Successfully updated OptionEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error updating OptionEdge:', error);
    return NextResponse.json({ error: 'Failed to update OptionEdge' }, { status: 500 });
  }
}

// DELETE /api/graph/option/edges/[id] - Delete a specific edge
export async function DELETE(req: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    
    console.log(`[API] Deleting OptionEdge with ID: ${id}`);
    
    if (!id) {
      console.warn('[API] Missing edge ID in request');
      return NextResponse.json(
        { error: 'Edge ID is required' },
        { status: 400 }
      );
    }
    
    // Check if the edge exists before deleting
    const existingEdge = await optionService.getEdge(id);
    if (!existingEdge) {
      console.warn(`[API] OptionEdge with ID: ${id} not found for deletion`);
      return NextResponse.json(
        { error: `Edge with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    await optionService.deleteEdge(id);
    
    console.log(`[API] Successfully deleted OptionEdge with ID: ${id}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[API] Error deleting OptionEdge:', error);
    return NextResponse.json({ error: 'Failed to delete OptionEdge' }, { status: 500 });
  }
} 