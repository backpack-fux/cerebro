import { NextRequest, NextResponse } from 'next/server';
import { optionService } from '@/services/graph/neo4j/neo4j.provider';
import { RFOptionEdge } from '@/services/graph/option/option.types';

// POST /api/graph/option/edges - Create a new edge between option nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting OptionEdge creation');
    const edge: RFOptionEdge = await req.json();
    
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid OptionEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    // Validate edge type
    const validEdgeTypes = ['OPTION_TEAM', 'OPTION_MEMBER', 'OPTION_DEPENDENCY', 'TEAM_OPTION', 'MEMBER_OPTION'];
    const normalizedType = edge.type.toUpperCase();
    if (!validEdgeTypes.includes(normalizedType)) {
      console.warn('[API] Invalid OptionEdge creation request: Invalid edge type');
      return NextResponse.json(
        { error: `Invalid edge type. Must be one of: ${validEdgeTypes.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[API] Received OptionEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    const createdEdge = await optionService.createEdge(edge);
    
    console.log('[API] Successfully created OptionEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data
    });

    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating OptionEdge:', error);
    return NextResponse.json({ error: 'Failed to create OptionEdge' }, { status: 500 });
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

    return NextResponse.json(edges);
  } catch (error) {
    console.error('[API] Error getting OptionEdges:', error);
    return NextResponse.json({ error: 'Failed to get OptionEdges' }, { status: 500 });
  }
} 