import { NextResponse } from 'next/server';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { GraphEdge } from '@/services/graph/neo4j/graph.interface';

// This endpoint will deduplicate edges in the database
export async function GET() {
  try {
    console.log('[API] Starting edge deduplication');
    
    // Get the full graph
    const graphData = await neo4jStorage.getFullGraph();
    
    console.log('[API] Retrieved graph data:', {
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length
    });

    // Group edges by source-target combination
    const edgeGroups = new Map<string, GraphEdge[]>();
    
    graphData.edges.forEach(edge => {
      const key = `${edge.from}-${edge.to}`;
      if (!edgeGroups.has(key)) {
        edgeGroups.set(key, []);
      }
      edgeGroups.get(key)!.push(edge);
    });
    
    // Find groups with duplicates
    const duplicateGroups = Array.from(edgeGroups.entries())
      .filter(([, edges]) => edges.length > 1);
    
    console.log(`[API] Found ${duplicateGroups.length} groups of duplicate edges`);
    
    // For each group with duplicates, keep the newest one and delete the rest
    const deletedEdges: string[] = [];
    
    for (const [, edges] of duplicateGroups) {
      // Sort by ID (assuming higher IDs are newer)
      const sortedEdges = [...edges].sort((a, b) => 
        a.id.localeCompare(b.id)
      );
      
      // Keep the newest one (last in the sorted array)
      sortedEdges.pop();
      
      // Delete the rest
      for (const edge of sortedEdges) {
        console.log(`[API] Deleting duplicate edge: ${edge.id}`);
        await neo4jStorage.deleteEdge(edge.id);
        deletedEdges.push(edge.id);
      }
    }
    
    return NextResponse.json({
      success: true,
      deletedEdges,
      message: `Successfully deleted ${deletedEdges.length} duplicate edges`
    });
  } catch (error) {
    console.error('[API] Error deduplicating edges:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to deduplicate edges',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 