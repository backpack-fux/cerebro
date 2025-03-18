import { NextRequest, NextResponse } from 'next/server';
import { milestoneService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateMilestoneNodeParams } from '@/services/graph/milestone/milestone.types';

// GET /api/graph/milestone
export async function GET() {
  try {
    const nodes = await milestoneService.getAllMilestoneNodes();
    return NextResponse.json(nodes);
  } catch (error) {
    console.error('[API] Error getting milestone nodes:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json({ 
      error: 'Failed to get milestone nodes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/graph/milestone
export async function POST(request: NextRequest) {
  try {
    console.log('[API] Starting MilestoneNode creation');
    const requestBody = await request.json();
    console.log('[API] Milestone creation request body:', JSON.stringify(requestBody));
    
    // Extract milestone data from the request body
    let milestoneData: Partial<CreateMilestoneNodeParams>;
    
    if ('data' in requestBody && typeof requestBody.data === 'object') {
      // Format: { data: { title, position, ... } }
      milestoneData = requestBody.data;
    } else if ('title' in requestBody) {
      // Format: { title, position, ... } - direct properties
      milestoneData = requestBody;
    } else {
      console.warn('[API] Invalid milestone creation request: Invalid request body format');
      return NextResponse.json({ 
        error: 'Invalid request body format',
        details: 'Request body must include title and position'
      }, { status: 400 });
    }
    
    // Validate required fields
    if (!milestoneData.title || !milestoneData.position) {
      console.warn('[API] Invalid milestone creation request: Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'Request body must include title and position'
      }, { status: 400 });
    }
    
    // Validate position format
    if (typeof milestoneData.position !== 'object' || 
        !('x' in milestoneData.position) || 
        !('y' in milestoneData.position) ||
        typeof milestoneData.position.x !== 'number' ||
        typeof milestoneData.position.y !== 'number') {
      console.warn('[API] Invalid milestone creation request: Invalid position format');
      return NextResponse.json({
        error: 'Invalid position format',
        details: 'Position must be an object with numeric x and y properties'
      }, { status: 400 });
    }
    
    // Prepare the final params object
    const milestoneParams: CreateMilestoneNodeParams = {
      title: milestoneData.title,
      description: milestoneData.description || '',
      status: milestoneData.status,
      position: milestoneData.position,
      kpis: milestoneData.kpis || []
    };
    
    console.log('[API] Creating milestone with params:', JSON.stringify(milestoneParams));
    
    const node = await milestoneService.createMilestoneNode(milestoneParams);
    
    console.log('[API] Successfully created milestone:', {
      id: node.id,
      title: node.data.title,
      position: node.position,
    });
    
    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating milestone node:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      const neo4jError = error as { code: string; message: string };
      console.error('[API] Neo4j error details:', {
        code: neo4jError.code,
        message: neo4jError.message
      });
    }
    
    return NextResponse.json({ 
      error: 'Failed to create milestone node',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}