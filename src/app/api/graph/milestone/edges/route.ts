import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { RFMilestoneEdge } from '@/services/graph/milestone/milestone.types';

// POST /api/graph/milestone/edges
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const edge = body as RFMilestoneEdge;
    
    if (!edge.source || !edge.target) {
      return NextResponse.json({ error: 'Source and target are required' }, { status: 400 });
    }
    
    const result = await milestoneService.createMilestoneEdge(edge);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error creating milestone edge:', error);
    return NextResponse.json({ error: 'Failed to create milestone edge' }, { status: 500 });
  }
} 