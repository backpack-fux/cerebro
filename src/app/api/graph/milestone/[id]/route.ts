import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateMilestoneNodeParams } from '@/services/graph/milestone/milestone.types';

// Helper function to extract ID from URL
function getIdFromUrl(request: NextRequest): string {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

// GET /api/graph/milestone/[id]
export async function GET(request: NextRequest) {
  try {
    const id = getIdFromUrl(request);
    console.log(`[API] Getting milestone node: ${id}`);
    
    const node = await milestoneService.getMilestoneNode(id);
    
    if (!node) {
      return NextResponse.json({ error: 'Milestone node not found' }, { status: 404 });
    }
    
    return NextResponse.json(node);
  } catch (error) {
    const id = getIdFromUrl(request);
    console.error(`[API] Error getting milestone node ${id}:`, error);
    return NextResponse.json({ error: 'Failed to get milestone node' }, { status: 500 });
  }
}

// PATCH /api/graph/milestone/[id]
export async function PATCH(request: NextRequest) {
  try {
    const id = getIdFromUrl(request);
    console.log(`[API] Updating milestone node: ${id}`);
    
    const body = await request.json();
    
    // Combine the ID from the URL with the update data from the body
    const updateParams: UpdateMilestoneNodeParams = {
      id,
      ...body,
    };
    
    const node = await milestoneService.updateMilestoneNode(updateParams);
    return NextResponse.json(node);
  } catch (error) {
    const id = getIdFromUrl(request);
    console.error(`[API] Error updating milestone node ${id}:`, error);
    return NextResponse.json({ error: 'Failed to update milestone node' }, { status: 500 });
  }
}

// DELETE /api/graph/milestone/[id]
export async function DELETE(request: NextRequest) {
  try {
    const id = getIdFromUrl(request);
    console.log(`[API] Deleting milestone node: ${id}`);
    
    await milestoneService.deleteMilestoneNode(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const id = getIdFromUrl(request);
    console.error(`[API] Error deleting milestone node ${id}:`, error);
    return NextResponse.json({ error: 'Failed to delete milestone node' }, { status: 500 });
  }
} 