import { NextResponse, NextRequest } from 'next/server';
import { featureService, createFeatureStorage } from '@/services/graph/neo4j/neo4j.provider';
import { PARENT_CHILD_EDGE_TYPE } from '@/services/graph/hierarchy/hierarchy.types';
import { HierarchicalNodeRelationship } from '@/services/graph/hierarchy/hierarchy.types';

// Initialize the feature storage
const featureStorage = createFeatureStorage();

/**
 * POST feature node child relationship
 * 
 * Creates a parent-child relationship between two feature nodes
 */
export async function POST(request: NextRequest) {
  // Use URL path to extract IDs - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const childId = segments[segments.length - 1];
  const parentId = segments[segments.length - 3];
  
  console.log(`[API] Creating parent-child relationship between ${parentId} and ${childId}`);
  
  if (!parentId || !childId) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "400", 
          message: "Missing required parameters" 
        } 
      },
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
          error: { 
            code: "404", 
            message: !parentNode ? 'Parent node not found' : 'Child node not found' 
          } 
        },
        { status: 404 }
      );
    }
    
    // Check if relationship already exists
    const edges = await featureStorage.getEdges(parentId, PARENT_CHILD_EDGE_TYPE);
    const existingEdge = edges.find(edge => edge.to === childId);
    
    if (existingEdge) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "409", 
            message: 'Parent-child relationship already exists' 
          } 
        },
        { status: 409 }
      );
    }
    
    // Check if the child already has a parent (to avoid multiple parents)
    const parentEdges = await featureStorage.getEdges(childId);
    const incomingEdges = parentEdges.filter(edge => edge.type === PARENT_CHILD_EDGE_TYPE && edge.to === childId);
    if (incomingEdges && incomingEdges.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "409", 
            message: 'Child node already has a parent. Remove existing relationship first.' 
          } 
        },
        { status: 409 }
      );
    }
    
    // Create the edge for the relationship
    const edgeData = {
      id: `${parentId}_${childId}_${PARENT_CHILD_EDGE_TYPE}`,
      from: parentId,
      to: childId,
      type: PARENT_CHILD_EDGE_TYPE
    };
    const edge = await featureStorage.createEdge(edgeData);
    
    // Update the parent node to include this child in its childIds array
    const parentHierarchy: HierarchicalNodeRelationship = parentNode.data?.hierarchy || { 
      isRollup: false, 
      childIds: [],
      parentId: null
    };
    
    await featureService.update({
      id: parentId,
      hierarchy: {
        ...parentHierarchy,
        isRollup: true, // Mark as rollup node since it now has a child
        childIds: [...(parentHierarchy.childIds || []), childId]
      }
    });
    
    // Update the child node to reference its parent
    const childHierarchy: HierarchicalNodeRelationship = childNode.data?.hierarchy || { 
      isRollup: false,
      childIds: [],
      parentId: null 
    };
    
    await featureService.update({
      id: childId,
      hierarchy: {
        ...childHierarchy,
        parentId: parentId
      }
    });
    
    return NextResponse.json({ 
      success: true,
      data: {
        relationship: edge,
        parent: {
          id: parentId,
          isRollup: true
        },
        child: {
          id: childId,
          parentId: parentId
        }
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error(`[API] Error creating parent-child relationship between ${parentId} and ${childId}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "500", 
          message: 'Failed to create parent-child relationship' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE feature node child relationship
 * 
 * Removes a parent-child relationship between two feature nodes
 */
export async function DELETE(request: NextRequest) {
  // Use URL path to extract IDs - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const childId = segments[segments.length - 1];
  const parentId = segments[segments.length - 3];
  
  console.log(`[API] Removing parent-child relationship between ${parentId} and ${childId}`);
  
  if (!parentId || !childId) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "400", 
          message: 'Missing required parameters' 
        } 
      },
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
          error: { 
            code: "404", 
            message: !parentNode ? 'Parent node not found' : 'Child node not found' 
          } 
        },
        { status: 404 }
      );
    }
    
    // Find and delete the relationship
    const edges = await featureStorage.getEdges(parentId, PARENT_CHILD_EDGE_TYPE);
    const parentChildEdges = edges.filter(edge => edge.to === childId);
    
    if (!parentChildEdges || parentChildEdges.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "404", 
            message: 'Parent-child relationship does not exist' 
          } 
        },
        { status: 404 }
      );
    }
    
    // Delete the edge
    await featureStorage.deleteEdge(parentChildEdges[0].id);
    
    // Update the hierarchy data for both parent and child
    // Child node should no longer reference parent
    if (childNode.data && childNode.data.hierarchy && childNode.data.hierarchy.parentId === parentId) {
      const childHierarchy: HierarchicalNodeRelationship = childNode.data.hierarchy;
      // Update the child hierarchy data
      await featureService.update({
        id: childId,
        hierarchy: {
          ...childHierarchy,
          parentId: null
        }
      });
    }
    
    // Update the parent node to remove this child from its childIds array
    if (parentNode.data && parentNode.data.hierarchy) {
      const parentHierarchy: HierarchicalNodeRelationship = parentNode.data.hierarchy;
      const updatedChildIds = parentHierarchy.childIds.filter(id => id !== childId);
      
      await featureService.update({
        id: parentId,
        hierarchy: {
          ...parentHierarchy,
          childIds: updatedChildIds,
          // If no more children, could set isRollup to false
          isRollup: updatedChildIds.length > 0
        }
      });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error(`[API] Error removing parent-child relationship between ${parentId} and ${childId}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "500", 
          message: 'Failed to remove parent-child relationship' 
        } 
      },
      { status: 500 }
    );
  }
} 