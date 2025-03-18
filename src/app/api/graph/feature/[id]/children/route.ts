import { NextResponse, NextRequest } from 'next/server';
import { featureService, createFeatureStorage } from '@/services/graph/neo4j/neo4j.provider';
import { PARENT_CHILD_EDGE_TYPE } from '@/services/graph/hierarchy/hierarchy.types';

// Initialize the feature service with the correct storage type
const featureStorage = createFeatureStorage();

/**
 * GET feature node children
 * 
 * Retrieves all child nodes of a feature node.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const featureId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Getting children for feature: ${featureId}`);
  
  if (!featureId) {
    return NextResponse.json(
      { success: false, error: 'Missing feature ID' },
      { status: 400 }
    );
  }
  
  try {
    // Query to get all child nodes connected with a PARENT_CHILD edge
    const edges = await featureStorage.getEdges(featureId, PARENT_CHILD_EDGE_TYPE);
    
    if (!edges || edges.length === 0) {
      // No children found
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    // Get the IDs of all child nodes
    const childIds = edges.map(edge => edge.to);
    
    // Fetch all child nodes in parallel
    const childNodes = await Promise.all(
      childIds.map(async (childId) => {
        const node = await featureService.getById(childId);
        if (!node) return null;
        
        // Get the edge to access relationship properties
        const edge = edges.find(e => e.to === childId);
        
        // Add relationship properties to the node data
        return {
          ...node,
          rollupContribution: edge?.properties?.rollupContribution !== false, // Default to true if not specified
          weight: edge?.properties?.weight || 1 // Default weight is 1
        };
      })
    );
    
    // Filter out null values (nodes that couldn't be retrieved)
    const validChildNodes = childNodes.filter(node => node !== null);
    
    return NextResponse.json({
      success: true,
      data: validChildNodes
    });
    
  } catch (error) {
    console.error(`[API] Error getting children of feature ${featureId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to get feature children' },
      { status: 500 }
    );
  }
}

/**
 * POST feature node child
 * 
 * Creates a parent-child relationship between a parent feature and a child feature.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use URL path to extract ID - more reliable way in Next.js 13+
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const parentId = segments[segments.length - 2]; // Get the ID from the URL path
  
  console.log(`[API] Creating child relationship for parent feature: ${parentId}`);
  
  if (!parentId) {
    return NextResponse.json(
      { success: false, error: 'Missing parent feature ID' },
      { status: 400 }
    );
  }
  
  try {
    const body = await request.json();
    const { childId, rollupContribution = true, weight = 1 } = body;
    
    if (!childId) {
      return NextResponse.json(
        { success: false, error: 'Child ID is required' },
        { status: 400 }
      );
    }
    
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
    
    // Check if relationship already exists
    const existingEdges = await featureStorage.getEdges(parentId, PARENT_CHILD_EDGE_TYPE);
    if (existingEdges && existingEdges.some(edge => edge.to === childId)) {
      return NextResponse.json(
        { success: false, error: 'Parent-child relationship already exists' },
        { status: 409 }
      );
    }
    
    // Create the edge
    const edge = {
      id: crypto.randomUUID(),
      from: parentId,
      to: childId,
      type: PARENT_CHILD_EDGE_TYPE,
      properties: {
        rollupContribution,
        weight,
        // Add React Flow specific properties
        sourceHandle: 'bottom', // Parent node connects from bottom
        targetHandle: 'top',    // Child node connects at top
        animated: true,         // Add animation to show data flow
        style: { strokeWidth: 2 } // Thicker line for hierarchical relationships
      }
    };
    
    await featureStorage.createEdge(edge);
    
    // Update the hierarchy data for both parent and child
    // Update child to reference parent
    if (childNode.data && childNode.data.hierarchy) {
      await featureService.update({
        id: childId,
        hierarchy: {
          ...childNode.data.hierarchy,
          parentId
        }
      });
    } else {
      await featureService.update({
        id: childId,
        hierarchy: {
          parentId,
          childIds: [],
          isRollup: false
        }
      });
    }
    
    // Update parent to reference child
    if (parentNode.data && parentNode.data.hierarchy) {
      const updatedChildIds = [
        ...(parentNode.data.hierarchy.childIds || []),
        childId
      ];
      
      await featureService.update({
        id: parentId,
        hierarchy: {
          ...parentNode.data.hierarchy,
          childIds: updatedChildIds,
          isRollup: true
        }
      });
    } else {
      await featureService.update({
        id: parentId,
        hierarchy: {
          parentId: null,
          childIds: [childId],
          isRollup: true
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        parentId,
        childId,
        rollupContribution,
        weight
      }
    });
    
  } catch (error) {
    console.error(`[API] Error creating parent-child relationship for feature ${parentId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to create parent-child relationship' },
      { status: 500 }
    );
  }
} 