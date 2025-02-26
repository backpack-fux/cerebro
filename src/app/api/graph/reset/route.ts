import { NextRequest, NextResponse } from 'next/server';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';

/**
 * POST /api/graph/reset - Reset the entire graph by deleting all nodes and relationships
 * This is a destructive operation and should be used with caution
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting graph reset operation');
    
    // Check for confirmation in the request body
    const body = await req.json().catch(() => ({}));
    const { confirm } = body;
    
    if (confirm !== 'RESET_GRAPH') {
      console.warn('[API] Graph reset operation aborted: Missing or invalid confirmation');
      return NextResponse.json(
        { 
          error: 'Missing or invalid confirmation', 
          message: 'To reset the graph, include {"confirm": "RESET_GRAPH"} in the request body' 
        },
        { status: 400 }
      );
    }
    
    // Reset the graph
    await neo4jStorage.resetGraph();
    
    console.log('[API] Graph reset operation completed successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Graph has been reset. All nodes and relationships have been deleted.' 
    });
  } catch (error) {
    console.error('[API] Error resetting graph:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    return NextResponse.json(
      { error: 'Failed to reset graph', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 