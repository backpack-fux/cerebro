import { NextRequest, NextResponse } from 'next/server';
import { teamService, featureService } from '@/services/graph/neo4j/neo4j.provider';
import { RFTeamEdge } from '@/services/graph/team/team.types';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';

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

    // Check if this is a connection to a feature node
    // First try to get the node from the feature service
    let isFeatureConnection = false;
    let featureNode = null;
    try {
      featureNode = await featureService.getNode(edge.target);
      isFeatureConnection = !!featureNode;
      console.log(`[API] Target node check: ${isFeatureConnection ? 'Is a feature node' : 'Not a feature node'}`);
    } catch (error) {
      console.log('[API] Error checking if target is a feature node, assuming it is not:', error);
    }
    
    let createdEdge;
    
    if (isFeatureConnection) {
      console.log(`[API] Detected team to feature connection: Team ${edge.source}, Feature ${edge.target}`);
      
      // STEP 1: Create the edge between team and feature
      // Use the standard edge creation to ensure the edge is created properly
      createdEdge = await teamService.createEdge(edge);
      console.log('[API] Created edge between team and feature:', createdEdge);
      
      // STEP 2: Update the team node with feature information
      // This is similar to how we update a team member with team information
      const teamId = edge.source;
      const featureId = edge.target;
      const requestedHours = edge.data?.allocation || 0;
      
      // Get the current team data
      const teamNode = await teamService.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      
      // Update the team with feature information
      // This could include adding the feature to a "features" array on the team
      // For now, we'll just log this step
      console.log(`[API] Would update team ${teamId} with feature ${featureId} information`);
      
      // STEP 3: Update the feature node with team allocation information
      // Use direct service call instead of API call
      await featureService.update({
        id: featureId,
        teamAllocations: [{
          teamId,
          requestedHours,
          allocatedMembers: []
        }]
      });
      
      console.log('[API] Updated feature with team allocation information');
      
      console.log('[API] Successfully added team to feature:', {
        featureId: edge.target,
        teamId: edge.source,
        requestedHours
      });
    } else {
      // Use TeamService to create the edge
      createdEdge = await teamService.createEdge(edge);
    }
    
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