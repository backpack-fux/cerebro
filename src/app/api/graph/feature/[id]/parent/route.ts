import { NextResponse, NextRequest } from 'next/server';
import { featureService, createFeatureStorage } from '@/services/graph/neo4j/neo4j.provider';
import { PARENT_CHILD_EDGE_TYPE } from '@/services/graph/hierarchy/hierarchy.types';
import { HierarchicalNodeRelationship } from '@/services/graph/hierarchy/hierarchy.types';

// Initialize the feature service with the correct storage type
const featureStorage = createFeatureStorage();

/**
 * GET feature node parent
 * 
 * Retrieves the parent node of a feature node.
 */
export async function GET(request: NextRequest) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const featureId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Getting parent for feature: ${featureId}`);
  
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
  
  try {
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
    
    // Query to get the parent node connected with a PARENT_CHILD edge
    const edges = await featureStorage.getEdges(featureId, PARENT_CHILD_EDGE_TYPE);
    
    // Filter for incoming edges where this node is the target/to
    const parentEdges = edges.filter(edge => edge.to === featureId);
    
    if (!parentEdges || parentEdges.length === 0) {
      // No parent found - this is a valid case, not an error
      return NextResponse.json({
        success: true,
        data: null
      });
    }
    
    // Check if we have more than one parent (shouldn't happen, but handle it)
    if (parentEdges.length > 1) {
      console.warn(`[API] Multiple parents found for feature ${featureId}. Using first parent.`);
    }
    
    // Get the first parent edge (there should only be one)
    const parentEdge = parentEdges[0];
    
    // Get the parent node
    const parentNode = await featureService.getById(parentEdge.from);
    
    if (!parentNode) {
      // Parent reference exists but node not found - this is an inconsistency
      console.error(`[API] Parent node ${parentEdge.from} referenced by edge ${parentEdge.id} not found`);
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "404", 
            message: 'Referenced parent node not found', 
            details: {
              edgeId: parentEdge.id,
              parentId: parentEdge.from
            }
          } 
        },
        { status: 404 }
      );
    }
    
    // Add relationship properties
    const parentData = {
      ...parentNode,
      relationshipId: parentEdge.id,
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
      { 
        success: false, 
        error: { 
          code: "500", 
          message: 'Failed to get feature parent',
          details: error instanceof Error ? { message: error.message } : undefined
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT feature node parent
 * 
 * Sets the parent of a feature node.
 * If the node already has a parent, it will be replaced.
 * 
 * Request body:
 * {
 *   parentId: string,              // ID of the parent node
 *   rollupContribution?: boolean,  // Whether this child contributes to parent rollup (default: true)
 *   weight?: number                // Weight of this child in rollup calculations (default: 1)
 * }
 */
export async function PUT(request: NextRequest) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const childId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Setting parent for feature: ${childId}`);
  
  if (!childId) {
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
  
  try {
    // Parse request body
    const body = await request.json();
    const { parentId, rollupContribution = true, weight = 1 } = body;
    
    if (!parentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "400", 
            message: 'Parent ID is required' 
          } 
        },
        { status: 400 }
      );
    }
    
    // Check if the parent and child nodes exist
    const [childNode, parentNode] = await Promise.all([
      featureService.getById(childId),
      featureService.getById(parentId)
    ]);
    
    if (!childNode) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "404", 
            message: 'Child feature node not found' 
          } 
        },
        { status: 404 }
      );
    }
    
    if (!parentNode) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "404", 
            message: 'Parent feature node not found' 
          } 
        },
        { status: 404 }
      );
    }
    
    // Prevent circular references
    if (childId === parentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "400", 
            message: 'A node cannot be its own parent' 
          } 
        },
        { status: 400 }
      );
    }
    
    // First check if the child node already has a parent
    const existingEdges = await featureStorage.getEdges(childId, PARENT_CHILD_EDGE_TYPE);
    const incomingParentEdges = existingEdges.filter(edge => edge.to === childId);
    
    // If child already has a parent, remove that relationship first
    if (incomingParentEdges.length > 0) {
      // If the existing parent is the same as the new parent, just update the properties
      const existingParentEdge = incomingParentEdges[0];
      if (existingParentEdge.from === parentId) {
        // Update edge properties
        await featureStorage.updateEdge(existingParentEdge.id, {
          rollupContribution,
          weight,
          updatedAt: new Date().toISOString()
        });
        
        // Get the updated parent data
        const updatedParentNode = await featureService.getById(parentId);
        
        return NextResponse.json({
          success: true,
          message: 'Updated existing parent relationship',
          data: {
            relationshipId: existingParentEdge.id,
            child: childId,
            parent: {
              ...updatedParentNode,
              rollupContribution,
              weight
            }
          }
        });
      }
      
      // Different parent - remove the existing relationship
      const oldParentId = existingParentEdge.from;
      
      // Delete the edge
      await featureStorage.deleteEdge(existingParentEdge.id);
      
      // Update the old parent's childIds array
      const oldParentNode = await featureService.getById(oldParentId);
      if (oldParentNode && oldParentNode.data?.hierarchy) {
        const updatedChildIds = oldParentNode.data.hierarchy.childIds.filter(id => id !== childId);
        
        await featureService.update({
          id: oldParentId,
          hierarchy: {
            ...oldParentNode.data.hierarchy,
            childIds: updatedChildIds,
            isRollup: updatedChildIds.length > 0
          }
        });
      }
      
      console.log(`[API] Removed existing parent relationship between ${oldParentId} and ${childId}`);
    }
    
    // Create a new edge for the parent-child relationship
    const edge = {
      id: `${parentId}_${childId}_${PARENT_CHILD_EDGE_TYPE}`,
      from: parentId,
      to: childId,
      type: PARENT_CHILD_EDGE_TYPE,
      properties: {
        rollupContribution,
        weight,
        createdAt: new Date().toISOString(),
        // Add React Flow specific properties
        sourceHandle: 'bottom', // Parent node connects from bottom
        targetHandle: 'top',    // Child node connects at top
        animated: true,         // Add animation to show data flow
        style: { strokeWidth: 2 } // Thicker line for hierarchical relationships
      }
    };
    
    await featureStorage.createEdge(edge);
    
    // Update the parent node's childIds array
    const parentHierarchy: HierarchicalNodeRelationship = parentNode.data?.hierarchy || {
      parentId: null,
      childIds: [],
      isRollup: false
    };
    
    // Check if the child is already in the parent's childIds array
    if (!parentHierarchy.childIds.includes(childId)) {
      await featureService.update({
        id: parentId,
        hierarchy: {
          ...parentHierarchy,
          childIds: [...parentHierarchy.childIds, childId],
          isRollup: true // Set to true since it now has at least one child
        }
      });
    }
    
    // Update the child node to reference its new parent
    const childHierarchy: HierarchicalNodeRelationship = childNode.data?.hierarchy || {
      parentId: null,
      childIds: [],
      isRollup: false
    };
    
    await featureService.update({
      id: childId,
      hierarchy: {
        ...childHierarchy,
        parentId: parentId
      }
    });
    
    // Get the updated parent node to return
    const updatedParentNode = await featureService.getById(parentId);
    
    return NextResponse.json({
      success: true,
      message: 'Parent relationship created successfully',
      data: {
        relationshipId: edge.id,
        child: childId,
        parent: {
          ...updatedParentNode,
          rollupContribution,
          weight
        }
      }
    });
    
  } catch (error) {
    console.error(`[API] Error setting parent for feature ${childId}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "500", 
          message: 'Failed to set feature parent',
          details: error instanceof Error ? { message: error.message } : undefined
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE feature node parent
 * 
 * Removes the parent relationship from a feature node.
 */
export async function DELETE(request: NextRequest) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const featureId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Removing parent for feature: ${featureId}`);
  
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
  
  try {
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
    
    // Query to get the parent node connected with a PARENT_CHILD edge
    const edges = await featureStorage.getEdges(featureId, PARENT_CHILD_EDGE_TYPE);
    
    // Filter for incoming edges where this node is the target/to
    const parentEdges = edges.filter(edge => edge.to === featureId);
    
    if (!parentEdges || parentEdges.length === 0) {
      // No parent found - nothing to delete
      return NextResponse.json({
        success: true,
        message: 'No parent relationship found to delete'
      });
    }
    
    // Get the first parent edge (there should only be one)
    const parentEdge = parentEdges[0];
    const parentId = parentEdge.from;
    
    // Delete the edge
    await featureStorage.deleteEdge(parentEdge.id);
    
    // Update the parent node's childIds array
    const parentNode = await featureService.getById(parentId);
    if (parentNode && parentNode.data?.hierarchy) {
      const parentHierarchy: HierarchicalNodeRelationship = parentNode.data.hierarchy;
      const updatedChildIds = parentHierarchy.childIds.filter(id => id !== featureId);
      
      await featureService.update({
        id: parentId,
        hierarchy: {
          ...parentHierarchy,
          childIds: updatedChildIds,
          isRollup: updatedChildIds.length > 0 // If no more children, set isRollup to false
        }
      });
    }
    
    // Update the child node to remove parent reference
    if (featureNode.data?.hierarchy) {
      const childHierarchy: HierarchicalNodeRelationship = featureNode.data.hierarchy;
      
      await featureService.update({
        id: featureId,
        hierarchy: {
          ...childHierarchy,
          parentId: null
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Parent relationship removed successfully',
      data: {
        childId: featureId,
        previousParentId: parentId
      }
    });
    
  } catch (error) {
    console.error(`[API] Error removing parent of feature ${featureId}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "500", 
          message: 'Failed to remove feature parent',
          details: error instanceof Error ? { message: error.message } : undefined
        } 
      },
      { status: 500 }
    );
  }
} 