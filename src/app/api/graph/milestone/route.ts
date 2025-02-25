import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateMilestoneNodeParams, UpdateMilestoneNodeParams } from '@/services/graph/milestone/milestone.types';

// GET /api/graph/milestone
export async function GET(request: NextRequest) {
  try {
    const nodes = await milestoneService.getAllMilestoneNodes();
    return NextResponse.json(nodes);
  } catch (error) {
    console.error('[API] Error getting milestone nodes:', error);
    return NextResponse.json({ error: 'Failed to get milestone nodes' }, { status: 500 });
  }
}

// POST /api/graph/milestone
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = body as CreateMilestoneNodeParams;
    
    if (!params.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    if (!params.position) {
      return NextResponse.json({ error: 'Position is required' }, { status: 400 });
    }
    
    const node = await milestoneService.createMilestoneNode(params);
    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error creating milestone node:', error);
    return NextResponse.json({ error: 'Failed to create milestone node' }, { status: 500 });
  }
} 