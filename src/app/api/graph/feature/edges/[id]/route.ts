import { NextRequest, NextResponse } from 'next/server';
import { featureService } from '@/services/graph/neo4j/neo4j.provider';

// GET /api/graph/feature/edges/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    console.log('[API] Getting feature edge:', id);
    
    const edge = await featureService.getEdge(id);
    if (!edge) {
      return NextResponse.json({ error: 'Edge not found' }, { status: 404 });
    }
    
    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error getting feature edge:', error);
    return NextResponse.json({ error: 'Failed to get feature edge' }, { status: 500 });
  }
}

// PATCH /api/graph/feature/edges/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const updates = await request.json();
    console.log('[API] Updating feature edge:', id, updates);
    
    const edge = await featureService.updateEdge(id, updates);
    if (!edge) {
      return NextResponse.json({ error: 'Edge not found' }, { status: 404 });
    }
    
    return NextResponse.json(edge);
  } catch (error) {
    console.error('[API] Error updating feature edge:', error);
    return NextResponse.json({ error: 'Failed to update feature edge' }, { status: 500 });
  }
}

// DELETE /api/graph/feature/edges/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    console.log('[API] Deleting feature edge:', id);
    
    await featureService.deleteEdge(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting feature edge:', error);
    return NextResponse.json({ error: 'Failed to delete feature edge' }, { status: 500 });
  }
} 