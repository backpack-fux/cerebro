import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/services/graph/neo4j/neo4j.provider';
import { RFTeamEdge } from '@/services/graph/team/team.types';

// POST /api/graph/team/edges - Create a new edge between team nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting TeamEdge creation');
    
    // Parse the request body as RFTeamEdge
    const edge: RFTeamEdge = await req.json();
    
    // Validate required fields
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid TeamEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received TeamEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    });

    // Use TeamService to create the edge
    const createdEdge = await teamService.createEdge(edge);
    
    console.log('[API] Successfully created TeamEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data,
    });

    // Return the created edge
    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating TeamEdge:', {
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
        error: 'Failed to create TeamEdge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/graph/team/edges - Get all edges
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Getting all TeamEdges');
    
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

    // Use TeamService to get the edges
    console.log('[API] Calling teamService.getEdges with:', { nodeId, type: type || undefined });
    
    const edges = await teamService.getEdges(nodeId, type || undefined);
    
    console.log('[API] Successfully retrieved TeamEdges:', {
      count: edges.length,
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
    });

    // Return the edges
    return NextResponse.json(edges);
  } catch (error) {
    console.error('[API] Error getting TeamEdges:', {
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
        error: 'Failed to get TeamEdges',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 