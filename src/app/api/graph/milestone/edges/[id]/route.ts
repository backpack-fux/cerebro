import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { RFMilestoneEdge } from '@/services/graph/milestone/milestone.types';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/graph/milestone/edges/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const edge = await milestoneService.getMilestoneEdge(id);
    
    if (!edge) {
      return NextResponse.json({ error: 'Milestone edge not found' }, { status: 404 });
    }
    
    return NextResponse.json(edge);
  } catch (error) {
    console.error(`[API] Error getting milestone edge ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to get milestone edge' }, { status: 500 });
  }
}

// PATCH /api/graph/milestone/edges/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const edge = await milestoneService.updateMilestoneEdge(id, body);
    
    if (!edge) {
      return NextResponse.json({ error: 'Milestone edge not found' }, { status: 404 });
    }
    
    return NextResponse.json(edge);
  } catch (error) {
    console.error(`[API] Error updating milestone edge ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update milestone edge' }, { status: 500 });
  }
}

// DELETE /api/graph/milestone/edges/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    await milestoneService.deleteMilestoneEdge(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] Error deleting milestone edge ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete milestone edge' }, { status: 500 });
  }
} 