import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/services/graph/neo4j/neo4j.provider';

interface Neo4jError {
  code: string;
  message: string;
}

// GET /api/graph/provider/[id]/edge - Get all edges for a provider
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 2]; // Get the provider id from the URL

    console.log('[API] Getting edges for ProviderNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if query parameters specify edge type
    const searchParams = new URL(request.url).searchParams;
    const edgeType = searchParams.get('type');

    // Get the edges
    const edges = await providerService.getEdges(id, edgeType || undefined);
    
    console.log('[API] Successfully retrieved edges for ProviderNode:', {
      id,
      count: edges.length,
      ...(edgeType && { type: edgeType })
    });

    // Return the edges
    return NextResponse.json(edges);
  } catch (error) {
    console.error('[API] Error getting edges for ProviderNode:', {
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
      { error: 'Failed to get edges for ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/graph/provider/[id]/edge - Create a new edge for a provider
export async function POST(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 2]; // Get the provider id from the URL

    console.log('[API] Creating edge for ProviderNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Parse the request body
    const edgeData = await request.json();
    
    // Ensure source ID is set to the provider ID
    const edgeWithSource = {
      ...edgeData,
      source: id
    };

    console.log('[API] Creating edge with data:', edgeWithSource);

    // Create the edge
    const edge = await providerService.createEdge(edgeWithSource);
    
    console.log('[API] Successfully created edge for ProviderNode:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    // Return the created edge
    return NextResponse.json(edge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating edge for ProviderNode:', {
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
      { error: 'Failed to create edge for ProviderNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 