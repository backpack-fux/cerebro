import { NextResponse, NextRequest } from 'next/server';
import { featureService, createFeatureStorage } from '@/services/graph/neo4j/neo4j.provider';
import { PARENT_CHILD_EDGE_TYPE } from '@/services/graph/hierarchy/hierarchy.types';

// Initialize the feature service with the correct storage type
const featureStorage = createFeatureStorage();

/**
 * GET feature node parent
 * 
 * Retrieves the parent node of a feature node.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const featureId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Getting parent for feature: ${featureId}`);
  
  if (!featureId) {
    return NextResponse.json(
      { success: false, error: 'Missing feature ID' },
      { status: 400 }
    );
  }
  
  try {
    // Query to get the parent node connected with a PARENT_CHILD edge
    const edges = await featureStorage.getEdges(featureId, PARENT_CHILD_EDGE_TYPE);
    
    // Filter for incoming edges where this node is the target/to
    const parentEdges = edges.filter(edge => edge.to === featureId);
    
    if (!parentEdges || parentEdges.length === 0) {
      // No parent found
      return NextResponse.json({
        success: true,
        data: null
      });
    }
    
    // Get the first parent edge (there should only be one)
    const parentEdge = parentEdges[0];
    
    // Get the parent node
    const parentNode = await featureService.getById(parentEdge.from);
    
    if (!parentNode) {
      // Parent reference exists but node not found
      return NextResponse.json({
        success: true,
        data: null
      });
    }
    
    // Add relationship properties
    const parentData = {
      ...parentNode,
      rollupContribution: parentEdge.properties?.rollupContribution !== false, // Default to true if not specified
      weight: parentEdge.properties?.weight || 1 // Default weight is 1
    };
    
    return NextResponse.json({
      success: true,
      data: parentData
    });
    
  } catch (error) {
    console.error(`[API] Error getting parent of feature ${featureId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to get feature parent' },
      { status: 500 }
    );
  }
} 