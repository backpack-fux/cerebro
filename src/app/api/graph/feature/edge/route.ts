// app/api/graph/feature/edge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FeatureService } from '@/services/graph/feature/feature.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { RFFeatureEdge } from '@/services/graph/feature/feature.types';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { teamService } from '@/services/graph/neo4j/neo4j.provider';

// Initialize the feature service
const featureService = new FeatureService(neo4jStorage);

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting FeatureEdge creation');
    const edge: RFFeatureEdge = await req.json();
    
    if (!edge.source || !edge.target || !edge.type) {
      console.warn('[API] Invalid FeatureEdge creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: source, target, and type are required' },
        { status: 400 }
      );
    }

    // Validate edge type
    const validEdgeTypes = ['FEATURE_TEAM', 'FEATURE_MEMBER', 'FEATURE_DEPENDENCY', 'TEAM_FEATURE', 'MEMBER_FEATURE'];
    const normalizedType = edge.type.toUpperCase();
    if (!validEdgeTypes.includes(normalizedType)) {
      console.warn('[API] Invalid FeatureEdge creation request: Invalid edge type');
      return NextResponse.json(
        { error: `Invalid edge type. Must be one of: ${validEdgeTypes.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[API] Received FeatureEdge creation request:', {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data
    });

    let createdEdge: RFFeatureEdge;

    // Handle different edge types
    if (normalizedType === 'FEATURE_TEAM' || normalizedType === 'TEAM_FEATURE') {
      // Determine which is the feature and which is the team
      const featureId = normalizedType === 'FEATURE_TEAM' ? edge.source : edge.target;
      const teamId = normalizedType === 'FEATURE_TEAM' ? edge.target : edge.source;
      
      console.log(`[API] Detected feature-team connection: Feature ${featureId}, Team ${teamId}`);
      
      // STEP 1: Create the edge between feature and team
      // Use the standard edge creation to ensure the edge is created properly
      createdEdge = await featureService.createEdge(edge);
      console.log('[API] Created edge between feature and team:', createdEdge);
      
      // STEP 2: Update the feature node with team allocation information
      const requestedHours = edge.data?.allocation || 0;
      
      // Get the current feature data
      const featureNode = await featureService.getNode(featureId);
      if (!featureNode) {
        throw new Error(`Feature with ID ${featureId} not found`);
      }
      
      // Update the feature with team allocation information using direct service call
      await featureService.update({
        id: featureId,
        teamAllocations: [{
          teamId,
          requestedHours,
          allocatedMembers: []
        }]
      });
      
      console.log('[API] Updated feature with team allocation information');
      
      // STEP 3: Update the team node with feature information
      // This could include adding the feature to a "features" array on the team
      // For now, we'll just log this step
      console.log(`[API] Would update team ${teamId} with feature ${featureId} information`);
    } 
    else if (normalizedType === 'FEATURE_MEMBER' || normalizedType === 'MEMBER_FEATURE') {
      // Determine which is the feature and which is the member
      const featureId = normalizedType === 'FEATURE_MEMBER' ? edge.source : edge.target;
      const memberId = normalizedType === 'FEATURE_MEMBER' ? edge.target : edge.source;
      
      console.log(`[API] Detected feature-member connection: Feature ${featureId}, Member ${memberId}`);
      
      // STEP 1: Create the edge between feature and member
      createdEdge = await featureService.createEdge(edge);
      console.log('[API] Created edge between feature and member:', createdEdge);
      
      // STEP 2: Update the feature with member allocation information
      const timePercentage = edge.data?.allocation || 0;
      
      // Update the feature with member allocation information using direct service call
      await featureService.update({
        id: featureId,
        memberAllocations: [{
          memberId,
          timePercentage
        }]
      });
      
      console.log('[API] Updated feature with member allocation information');
      
      // STEP 3: Update the member node with feature information
      // This could include adding the feature to a "features" array on the member
      // For now, we'll just log this step
      console.log(`[API] Would update member ${memberId} with feature ${featureId} information`);
    }
    else {
      // For other edge types, just create the edge
      createdEdge = await featureService.createEdge(edge);
    }
    
    console.log('[API] Successfully created FeatureEdge:', {
      id: createdEdge.id,
      source: createdEdge.source,
      target: createdEdge.target,
      type: createdEdge.type,
      data: createdEdge.data
    });

    return NextResponse.json(createdEdge, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating FeatureEdge:', {
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
      { error: 'Failed to create FeatureEdge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 