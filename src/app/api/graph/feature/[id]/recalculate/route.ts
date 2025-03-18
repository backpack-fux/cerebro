import { NextResponse, NextRequest } from 'next/server';
import { recalculateParentRollup } from '@/services/graph/hierarchy/hierarchy.service';

/**
 * POST /api/graph/feature/[id]/recalculate
 * 
 * Triggers a manual recalculation of rollup values for a parent node
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const featureId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Recalculating rollup values for feature: ${featureId}`);
  
  if (!featureId) {
    return NextResponse.json(
      { success: false, error: 'Missing feature ID' },
      { status: 400 }
    );
  }
  
  try {
    await recalculateParentRollup('feature', featureId);
    
    return NextResponse.json({
      success: true,
      message: `Rollup values recalculated successfully for feature ${featureId}`
    });
  } catch (error) {
    console.error(`[API] Error recalculating rollup values for feature ${featureId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to recalculate rollup values' },
      { status: 500 }
    );
  }
} 