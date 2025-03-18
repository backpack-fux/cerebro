import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateMilestoneNodeParams } from '@/services/graph/milestone/milestone.types';

// GET /api/graph/milestone
export async function GET() {
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
    
    // Type guard for CreateMilestoneNodeParams
    if (!isCreateMilestoneNodeParams(body)) {
      console.warn('[API] Invalid milestone creation request: Invalid request body format');
      return NextResponse.json({ 
        error: 'Invalid request body format',
        details: 'Request body must include title and position'
      }, { status: 400 });
    }
    
    const node = await milestoneService.createMilestoneNode(body);
    console.log('[API] Successfully created milestone:', {
      id: node.id,
      title: node.data.title,
      position: node.position,
    });
    
    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating milestone node:', error);
    return NextResponse.json({ error: 'Failed to create milestone node' }, { status: 500 });
  }
}

/**
 * Type guard to validate CreateMilestoneNodeParams
 */
function isCreateMilestoneNodeParams(value: unknown): value is CreateMilestoneNodeParams {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'position' in value &&
    typeof (value as CreateMilestoneNodeParams).title === 'string' &&
    typeof (value as CreateMilestoneNodeParams).position === 'object'
  );
} 