import { NextRequest, NextResponse } from 'next/server';
import { optionService } from '@/services/graph/neo4j/neo4j.provider';
import { RFOptionEdge } from '@/services/graph/option/option.types';

// POST /api/graph/option/edges - Create a new edge between option nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting OptionEdge creation');
    
    // Parse the request body as RFOptionEdge
    const edge: RFOptionEdge = await req.json();
    
    // Validate required fields
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid OptionEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received OptionEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    });

    // Use OptionService to create the edge
    const createdEdge = await optionService.createEdge(edge);
    
    console.log('[API] Successfully created OptionEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data,
    });

    // Return the created edge
    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating OptionEdge:', {
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
        error: 'Failed to create OptionEdge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/graph/option/edges - Get all edges
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Getting all OptionEdges');
    
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

    // Use OptionService to get the edges
    console.log('[API] Calling optionService.getEdges with:', { nodeId, type: type || undefined });
    
    const edges = await optionService.getEdges(nodeId, type || undefined);
    
    console.log('[API] Successfully retrieved OptionEdges:', {
      count: edges.length,
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
    });

    // Return the edges
    return NextResponse.json(edges);
  } catch (error) {
    console.error('[API] Error getting OptionEdges:', {
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
        error: 'Failed to get OptionEdges',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 