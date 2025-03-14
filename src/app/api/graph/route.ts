// pages/api/graph.ts (updated, no transforms in endpoint)
import { NextResponse } from 'next/server';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';

export async function GET() {
  try {
    console.log('[API] Starting graph data retrieval');
    
    // Use the generic Neo4jGraphStorage instance from neo4j.provider.ts
    const graphData = await neo4jStorage.getFullGraph();
    
    console.log('[API] Retrieved graph data:', {
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length
    });

    // Validate nodes (generic validation)
    const validNodes = graphData.nodes.filter(node => node && node.id && node.type);
    console.log('[API] Node validation complete:', {
      originalCount: graphData.nodes.length,
      validCount: validNodes.length,
      droppedCount: graphData.nodes.length - validNodes.length
    });

    // Log sample of nodes for debugging
    validNodes.slice(0, 3).forEach(node => {
      console.log('[API] Sample node:', {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      });
    });

    const response = {
      nodes: validNodes,
      edges: graphData.edges
    };

    console.log('[API] Sending response with:', {
      nodeCount: response.nodes.length,
      edgeCount: response.edges.length
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error retrieving graph data:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to retrieve graph data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}