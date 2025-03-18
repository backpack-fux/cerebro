import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/services/graph/neo4j/neo4j.provider';
import { RFProviderEdge } from '@/services/graph/provider/provider.types';

interface Neo4jErrorResponse {
  code: string;
  message: string;
}

// POST /api/graph/provider/edges - Create a new edge between provider nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting ProviderEdge creation');
    
    // Parse the request body as RFProviderEdge
    const edge: RFProviderEdge = await req.json();
    
    // Validate required fields
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid ProviderEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received ProviderEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    });

    // Use ProviderService to create the edge
    const createdEdge = await providerService.createEdge(edge);
    
    console.log('[API] Successfully created ProviderEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data,
    });

    // Return the created edge
    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating ProviderEdge:', {
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
      { 
        error: 'Failed to create ProviderEdge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/graph/provider/edges - Get all edges
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Getting all ProviderEdges');
    
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

    // Use ProviderService to get the edges
    console.log('[API] Calling providerService.getEdges with:', { nodeId, type: type || undefined });
    
    const edges = await providerService.getEdges(nodeId, type || undefined);
    
    console.log('[API] Successfully retrieved ProviderEdges:', {
      count: edges.length,
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
    });

    // Return the edges
    return NextResponse.json(edges);
  } catch (error) {
    console.error('[API] Error getting ProviderEdges:', {
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
      { 
        error: 'Failed to get ProviderEdges',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 