import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateMilestoneNodeParams } from '@/services/graph/milestone/milestone.types';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/graph/milestone/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const node = await milestoneService.getMilestoneNode(id);
    
    if (!node) {
      return NextResponse.json({ error: 'Milestone node not found' }, { status: 404 });
    }
    
    return NextResponse.json(node);
  } catch (error) {
    console.error(`[API] Error getting milestone node ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to get milestone node' }, { status: 500 });
  }
}

// PATCH /api/graph/milestone/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Combine the ID from the URL with the update data from the body
    const updateParams: UpdateMilestoneNodeParams = {
      id,
      ...body,
    };
    
    const node = await milestoneService.updateMilestoneNode(updateParams);
    return NextResponse.json(node);
  } catch (error) {
    console.error(`[API] Error updating milestone node ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update milestone node' }, { status: 500 });
  }
}

// DELETE /api/graph/milestone/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    await milestoneService.deleteMilestoneNode(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] Error deleting milestone node ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete milestone node' }, { status: 500 });
  }
} 