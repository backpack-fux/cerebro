import { NextRequest, NextResponse } from 'next/server';
import { metaService } from '@/services/graph/neo4j/neo4j.provider';
import { RFMetaEdge } from '@/services/graph/meta/meta.types';

// POST /api/graph/meta/edges - Create a new edge between meta nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting MetaEdge creation');
    
    // Parse the request body as RFMetaEdge
    const edge: RFMetaEdge = await req.json();
    
    // Validate required fields
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid MetaEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received MetaEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    });

    // Use MetaService to create the edge
    const createdEdge = await metaService.createEdge(edge);
    
    console.log('[API] Successfully created MetaEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data,
    });

    // Return the created edge
    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating MetaEdge:', {
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
      { 
        error: 'Failed to create MetaEdge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/graph/meta/edges - Get all edges
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Getting all MetaEdges');
    
    // Get the node ID from the query parameters
    const { searchParams } = new URL(req.url);
    const nodeId = searchParams.get('nodeId');
    const type = searchParams.get('type');
    
    console.log('[API] Query parameters:', { nodeId, type });
    
    if (!nodeId) {
      console.warn('[API] Missing required query parameter: nodeId');
      return NextResponse.json(
        { error: 'Missing required query parameter: nodeId' },
        { status: 400 }
      );
    }

    // Use MetaService to get the edges
    console.log('[API] Calling metaService.getEdges with:', { nodeId, type: type || undefined });
    try {
      const edges = await metaService.getEdges(nodeId, type || undefined);
      
      console.log('[API] Successfully retrieved MetaEdges:', {
        count: edges.length,
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
      });

      // Return the edges
      return NextResponse.json(edges);
    } catch (serviceError) {
      console.error('[API] Error in metaService.getEdges:', {
        error: serviceError instanceof Error ? serviceError.message : 'Unknown error',
        stack: serviceError instanceof Error ? serviceError.stack : undefined,
      });
      throw serviceError; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error('[API] Error getting MetaEdges:', {
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
      { error: 'Failed to get MetaEdges' },
      { status: 500 }
    );
  }
} 