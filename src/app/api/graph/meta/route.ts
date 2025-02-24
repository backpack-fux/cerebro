import { NextRequest, NextResponse } from "next/server";
import { GraphService } from "@/services/graph/neo4j/graph.service";
import { getGraphService } from "@/services/graph/neo4j/neo4j.provider";

export async function GET() {
  try {
    console.log('[API] Starting graph data retrieval');
    
    const graphService = getGraphService();
    console.log('[API] Graph service initialized');
    
    const graphData = await graphService.getFullGraph();
    
    console.log('[API] Retrieved graph data:', {
      nodeCount: graphData.nodes.length,
      relationshipCount: graphData.edges.length
    });

    // Validate nodes
    const validNodes = graphData.nodes.filter(node => {
      const isValid = node && node.id && node.type;
      if (!isValid) {
        console.warn('[API] Invalid node found:', node);
      }
      return isValid;
    });

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
      relationships: graphData.edges
    };

    console.log('[API] Sending response with:', {
      nodeCount: response.nodes.length,
      relationshipCount: response.relationships.length
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error retrieving graph data:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve graph data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const graphService = getGraphService();
    const data = await request.json();
    
    // Add position if not provided
    if (!data.position) {
      data.position = { x: 0, y: 0 };
    }
    
    const result = await graphService.createNode(data.type, {
      ...data.properties,
      position: data.position
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error creating node:", error);
    return NextResponse.json(
      { error: "Failed to create node" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const graphService = getGraphService();
    const edgeData = await request.json();
    const { from, to, type, properties } = edgeData;

    // Add relationship type validation
    const validRelationshipTypes = ['REQUIRES', 'RELATED', 'USES', 'PROVIDES', 'MANAGES'];
    if (!validRelationshipTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}` },
        { status: 400 },
      );
    }

    if (!from || !to || !type) {
      return NextResponse.json(
        { error: "Missing required edge data" },
        { status: 400 },
      );
    }

    const relationship = await graphService.createRelationship(
      from,
      to,
      type,
      properties || {},
    );

    return NextResponse.json(relationship);
  } catch (error) {
    console.error("[API] Error creating relationship:", error);
    return NextResponse.json(
      { error: "Failed to create relationship" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const graphService = getGraphService();
    const data = await request.json();
    const { from, to, type } = data;

    if (!from || !to || !type) {
      return NextResponse.json(
        { error: "Missing required relationship data" },
        { status: 400 },
      );
    }

    await graphService.deleteRelationship(from, to, type);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[API] Error deleting relationship:", error);
    return NextResponse.json(
      { error: "Failed to delete relationship" },
      { status: 500 },
    );
  }
}
