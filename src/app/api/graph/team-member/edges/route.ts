import { NextRequest, NextResponse } from 'next/server';
import { teamMemberService } from '@/services/graph/neo4j/neo4j.provider';
import { RFTeamMemberEdge } from '@/services/graph/team-member/team-member.types';

// POST /api/graph/team-member/edges - Create a new edge between team member nodes
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting TeamMemberEdge creation');
    
    // Parse the request body as RFTeamMemberEdge
    const edge: RFTeamMemberEdge = await req.json();
    
    // Validate required fields
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid TeamMemberEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received TeamMemberEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    });

    // Check if this is a team member to team connection
    // We can determine this by checking if the target node is a team node
    let createdEdge;
    
    try {
      const { neo4jStorage } = await import('@/services/graph/neo4j/neo4j.provider');
      const targetNode = await neo4jStorage.getNode(edge.target);
      
      // If the target node is a team node, use the connectToTeam method
      if (targetNode && targetNode.type === 'team') {
        console.log('[API] Detected team member to team connection, using connectToTeam method');
        
        // Extract allocation and role from edge data if available
        const allocation = (edge.data as any)?.allocation || 100;
        const role = (edge.data as any)?.role || 'Developer';
        
        // Use the connectToTeam method to handle both edge creation and roster update
        createdEdge = await teamMemberService.connectToTeam(
          edge.source,
          edge.target,
          allocation,
          role
        );
      } else {
        // For other edge types, use the regular createEdge method
        createdEdge = await teamMemberService.createEdge(edge);
      }
    } catch (error) {
      console.error('[API] Error checking node type:', error);
      // Fall back to regular edge creation
      createdEdge = await teamMemberService.createEdge(edge);
    }
    
    console.log('[API] Successfully created TeamMemberEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data,
    });

    // Return the created edge
    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating TeamMemberEdge:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      if (neo4jError.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
        return NextResponse.json(
          { error: 'Edge already exists or nodes do not exist' },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create TeamMemberEdge' },
      { status: 500 }
    );
  }
}

// GET /api/graph/team-member/edges - Get all team member edges
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Getting all TeamMemberEdges');
    
    // Use getEdges method with no parameters to get all edges
    // This is a workaround since there's no direct getAllEdges method
    const nodeId = req.nextUrl.searchParams.get('nodeId');
    
    let edges;
    if (nodeId) {
      // If nodeId is provided, get edges for that specific node
      console.log(`[API] Getting edges for TeamMember node: ${nodeId}`);
      edges = await teamMemberService.getEdges(nodeId);
    } else {
      // If no nodeId, we need to get all team member nodes first and then collect their edges
      console.log('[API] No nodeId provided, getting edges for all TeamMember nodes');
      const nodes = await teamMemberService.getAll();
      
      // Collect edges for all nodes
      const edgePromises = nodes.map(node => teamMemberService.getEdges(node.id));
      const edgeSets = await Promise.all(edgePromises);
      
      // Flatten the array of edge arrays and remove duplicates by ID
      const edgeMap = new Map();
      edgeSets.flat().forEach(edge => {
        edgeMap.set(edge.id, edge);
      });
      
      edges = Array.from(edgeMap.values());
    }
    
    console.log(`[API] Successfully retrieved ${edges.length} TeamMemberEdges`);
    
    return NextResponse.json(edges);
  } catch (error) {
    console.error('[API] Error getting TeamMemberEdges:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to get TeamMemberEdges' },
      { status: 500 }
    );
  }
} 