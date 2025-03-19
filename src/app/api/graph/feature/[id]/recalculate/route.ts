import { NextResponse, NextRequest } from 'next/server';
import { recalculateParentRollup } from '@/services/graph/hierarchy/hierarchy.service';
import { featureService } from '@/services/graph/neo4j/neo4j.provider';

/**
 * POST /api/graph/feature/[id]/recalculate
 * 
 * Triggers a manual recalculation of rollup values for a parent node
 * 
 * Request body (optional):
 * {
 *   fields: string[] // Specific fields to recalculate, e.g. ["cost", "time"]
 * }
 */
export async function POST(request: NextRequest) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const featureId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Recalculating rollup values for feature: ${featureId}`);
  
  if (!featureId) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "400", 
          message: 'Missing feature ID' 
        } 
      },
      { status: 400 }
    );
  }

  let fields: string[] = [];
  
  try {
    // Check if request has a body with fields to recalculate
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json();
      if (body && body.fields && Array.isArray(body.fields)) {
        fields = body.fields;
        console.log(`[API] Recalculating specific fields: ${fields.join(', ')}`);
      }
    }

    // First check if the feature node exists
    const featureNode = await featureService.getById(featureId);
    if (!featureNode) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "404", 
            message: 'Feature node not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Check if the node is a rollup node (has children)
    if (featureNode.data?.hierarchy && !featureNode.data.hierarchy.isRollup) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "400", 
            message: 'Node is not a rollup node (has no children)' 
          } 
        },
        { status: 400 }
      );
    }
    
    // Perform the recalculation
    await recalculateParentRollup('feature', featureId);
    
    return NextResponse.json({
      success: true,
      message: `Rollup values recalculated successfully for feature ${featureId}`,
      data: {
        id: featureId,
        recalculatedFields: fields.length > 0 ? fields : 'all'
      }
    });
  } catch (error) {
    console.error(`[API] Error recalculating rollup values for feature ${featureId}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "500", 
          message: 'Failed to recalculate rollup values',
          details: error instanceof Error ? { message: error.message } : undefined
        } 
      },
      { status: 500 }
    );
  }
} 