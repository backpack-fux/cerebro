// app/api/graph/feature/edge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FeatureService } from '@/services/graph/feature/feature.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { RFFeatureEdge } from '@/services/graph/feature/feature.types';

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
    const validEdgeTypes = ['FEATURE_TEAM', 'FEATURE_MEMBER', 'FEATURE_DEPENDENCY'];
    if (!validEdgeTypes.includes(edge.type.toUpperCase())) {
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

    // Create the edge
    const createdEdge = await featureService.createEdge(edge);
    
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