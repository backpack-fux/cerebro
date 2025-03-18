import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/services/graph/neo4j/neo4j.provider';

interface Neo4jError {
  code: string;
  message: string;
}

// GET /api/graph/provider/edge/[id] - Get a provider edge by ID
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting ProviderEdge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Get the edge
    const edge = await providerService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] ProviderEdge not found:', id);
      return NextResponse.json(
        { error: 'ProviderEdge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Successfully retrieved ProviderEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    // Return the edge
    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting ProviderEdge:', {
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
      { error: 'Failed to get ProviderEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/provider/edge/[id] - Update a provider edge by ID
export async function PATCH(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating ProviderEdge by ID:', id);
    
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
    const edge = await providerService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] ProviderEdge not found for update:', id);
      return NextResponse.json(
        { error: 'ProviderEdge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Updating ProviderEdge with data:', {
      id,
      properties: updateData
    });

    // Update the edge
    const updatedEdge = await providerService.updateEdge(id, updateData);
    
    console.log('[API] Successfully updated ProviderEdge:', {
      id: updatedEdge.id,
      source: updatedEdge.source,
      target: updatedEdge.target,
      type: updatedEdge.type,
      data: updatedEdge.data
    });

    // Return the updated edge
    return NextResponse.json(updatedEdge);
  } catch (error) {
    console.error('[API] Error updating ProviderEdge:', {
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
      { error: 'Failed to update ProviderEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/provider/edge/[id] - Delete a provider edge by ID
export async function DELETE(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting ProviderEdge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if the edge exists first
    const edge = await providerService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] ProviderEdge not found for deletion:', id);
      return NextResponse.json(
        { error: 'ProviderEdge not found' },
        { status: 404 }
      );
    }

    // Delete the edge
    await providerService.deleteEdge(id);
    
    console.log('[API] Successfully deleted ProviderEdge:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting ProviderEdge:', {
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
      { error: 'Failed to delete ProviderEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 