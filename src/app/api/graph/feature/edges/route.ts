import { NextRequest, NextResponse } from 'next/server';
import { featureService } from '@/services/graph/neo4j/neo4j.provider';
import { RFFeatureEdge } from '@/services/graph/feature/feature.types';

// POST /api/graph/feature/edges
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const edge = body as RFFeatureEdge;
    
    if (!edge.source || !edge.target) {
      return NextResponse.json({ error: 'Source and target are required' }, { status: 400 });
    }
    
    console.log('[API] Creating feature edge:', edge);
    
    // Handle different edge types based on the connected nodes
    const sourceType = edge.source.split('-')[0];
    const targetType = edge.target.split('-')[0];
    
    // Set the edge type if not provided
    if (!edge.type) {
      if (targetType === 'milestone' || sourceType === 'milestone') {
        edge.type = 'FEATURE_MILESTONE';
      } else if (targetType === 'team' || sourceType === 'team') {
        edge.type = 'FEATURE_TEAM';
      } else if (targetType === 'teamMember' || sourceType === 'teamMember') {
        edge.type = 'FEATURE_MEMBER';
      } else {
        edge.type = 'FEATURE_DEPENDENCY';
      }
    }
    
    const result = await featureService.createEdge(edge);
    console.log('[API] Created feature edge:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error creating feature edge:', error);
    return NextResponse.json({ error: 'Failed to create feature edge' }, { status: 500 });
  }
} 