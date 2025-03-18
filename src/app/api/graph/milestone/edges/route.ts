import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { RFMilestoneEdge } from '@/services/graph/milestone/milestone.types';

interface Neo4jError {
  code: string;
  message: string;
}

/**
 * Validates an RFMilestoneEdge object
 * @param edge The edge to validate
 * @returns True if valid, false otherwise
 */
function isValidRFMilestoneEdge(edge: unknown): edge is RFMilestoneEdge {
  if (!edge || typeof edge !== 'object') return false;
  
  const e = edge as Partial<RFMilestoneEdge>;
  return (
    typeof e.id === 'string' &&
    typeof e.source === 'string' &&
    typeof e.target === 'string' &&
    typeof e.type === 'string' &&
    (!e.data || typeof e.data === 'object')
  );
}

// GET /api/graph/milestone/edges - Get all edges
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Getting all MilestoneEdges');
    
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

    // Use MilestoneService to get the edges
    console.log('[API] Calling milestoneService.getMilestoneEdges with:', { nodeId, type: type || undefined });
    try {
      const edges = await milestoneService.getMilestoneEdges(nodeId, type || undefined);
      
      console.log('[API] Successfully retrieved MilestoneEdges:', {
        count: edges.length,
        edges: edges.map((e: RFMilestoneEdge) => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
      });

      // Return the edges
      return NextResponse.json(edges);
    } catch (serviceError) {
      console.error('[API] Error in milestoneService.getMilestoneEdges:', {
        error: serviceError instanceof Error ? serviceError.message : 'Unknown error',
        stack: serviceError instanceof Error ? serviceError.stack : undefined,
      });
      throw serviceError; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error('[API] Error getting MilestoneEdges:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get MilestoneEdges', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/graph/milestone/edges
export async function POST(request: NextRequest) {
  try {
    console.log('[API] Creating new MilestoneEdge');
    const body = await request.json();
    
    if (!isValidRFMilestoneEdge(body)) {
      console.warn('[API] Invalid MilestoneEdge creation request: Invalid parameters');
      return NextResponse.json(
        { error: 'Invalid parameters: id, source, target, and type are required' },
        { status: 400 }
      );
    }
    
    console.log('[API] Received MilestoneEdge creation request:', {
      id: body.id,
      source: body.source,
      target: body.target,
      type: body.type,
    });

    const result = await milestoneService.createMilestoneEdge(body);
    console.log('[API] Successfully created MilestoneEdge:', {
      id: result.id,
      source: result.source,
      target: result.target,
      type: result.type,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating MilestoneEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create MilestoneEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 