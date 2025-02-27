import { NextRequest, NextResponse } from 'next/server';
import { FeatureService } from '@/services/graph/feature/feature.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';

// Initialize the feature service
const featureService = new FeatureService(neo4jStorage);

// GET /api/graph/feature/edge/[id] - Get a feature edge by ID
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting FeatureEdge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Get the edge
    const edge = await featureService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] FeatureEdge not found:', id);
      return NextResponse.json(
        { error: 'FeatureEdge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Successfully retrieved FeatureEdge:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    // Return the edge
    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting FeatureEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get FeatureEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/feature/edge/[id] - Update a feature edge by ID
export async function PATCH(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating FeatureEdge by ID:', id);
    
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
    const edge = await featureService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] FeatureEdge not found for update:', id);
      return NextResponse.json(
        { error: 'FeatureEdge not found' },
        { status: 404 }
      );
    }

    console.log('[API] Updating FeatureEdge with data:', {
      id,
      properties: updateData
    });

    // Update the edge
    const updatedEdge = await featureService.updateEdge(id, updateData);
    
    console.log('[API] Successfully updated FeatureEdge:', {
      id: updatedEdge.id,
      source: updatedEdge.source,
      target: updatedEdge.target,
      type: updatedEdge.type,
      data: updatedEdge.data
    });

    // Return the updated edge
    return NextResponse.json(updatedEdge);
  } catch (error) {
    console.error('[API] Error updating FeatureEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update FeatureEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/feature/edge/[id] - Delete a feature edge by ID
export async function DELETE(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting FeatureEdge by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if the edge exists first
    const edge = await featureService.getEdge(id);
    
    if (!edge) {
      console.warn('[API] FeatureEdge not found for deletion:', id);
      return NextResponse.json(
        { error: 'FeatureEdge not found' },
        { status: 404 }
      );
    }

    // Delete the edge
    await featureService.deleteEdge(id);
    
    console.log('[API] Successfully deleted FeatureEdge:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting FeatureEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete FeatureEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 