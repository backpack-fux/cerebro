import { NextResponse, NextRequest } from 'next/server';
import { featureService, createFeatureStorage } from '@/services/graph/neo4j/neo4j.provider';
import { PARENT_CHILD_EDGE_TYPE } from '@/services/graph/hierarchy/hierarchy.types';

// Initialize the feature storage
const featureStorage = createFeatureStorage();

/**
 * DELETE feature node child relationship
 * 
 * Removes a parent-child relationship between two feature nodes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, childId: string } }
) {
  // Use URL path to extract IDs - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const childId = segments[segments.length - 1];
  const parentId = segments[segments.length - 3];
  
  console.log(`[API] Removing parent-child relationship between ${parentId} and ${childId}`);
  
  if (!parentId || !childId) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters' },
      { status: 400 }
    );
  }
  
  try {
    // First check if both nodes exist
    const [parentNode, childNode] = await Promise.all([
      featureService.getById(parentId),
      featureService.getById(childId)
    ]);

    if (!parentNode || !childNode) {
      return NextResponse.json(
        { 
          success: false, 
          error: !parentNode ? 'Parent node not found' : 'Child node not found' 
        },
        { status: 404 }
      );
    }
    
    // Find and delete the relationship
    const edges = await featureStorage.getEdges(parentId, PARENT_CHILD_EDGE_TYPE);
    const parentChildEdges = edges.filter(edge => edge.to === childId);
    
    if (!parentChildEdges || parentChildEdges.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Parent-child relationship does not exist' },
        { status: 404 }
      );
    }
    
    // Delete the edge
    await featureStorage.deleteEdge(parentChildEdges[0].id);
    
    // Update the hierarchy data for both parent and child
    // Child node should no longer reference parent
    if (childNode.data && childNode.data.hierarchy && childNode.data.hierarchy.parentId === parentId) {
      // Update the child hierarchy data
      await featureService.update({
        id: childId,
        hierarchy: {
          ...childNode.data.hierarchy,
          parentId: null
        }
      });
    }
    
    // Update the parent node to remove this child from its childIds array
    if (parentNode.data && parentNode.data.hierarchy) {
      const updatedChildIds = parentNode.data.hierarchy.childIds.filter(id => id !== childId);
      
      await featureService.update({
        id: parentId,
        hierarchy: {
          ...parentNode.data.hierarchy,
          childIds: updatedChildIds,
          // If no more children, could set isRollup to false, but we'll keep it true
          // in case more children are added later
        }
      });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error(`[API] Error removing parent-child relationship between ${parentId} and ${childId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove parent-child relationship' },
      { status: 500 }
    );
  }
} 