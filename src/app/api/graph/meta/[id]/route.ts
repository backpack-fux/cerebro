import { NextRequest, NextResponse } from 'next/server';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { UpdateMetaNodeParams } from '@/services/graph/meta/meta.types';

// GET /api/graph/meta/[id] - Get a meta node by ID
export async function GET(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Getting MetaNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Use the Neo4j storage's getNode method
    const node = await neo4jStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] MetaNode not found:', id);
      return NextResponse.json(
        { error: 'MetaNode not found' },
        { status: 404 }
      );
    }

    console.log('[API] Successfully retrieved MetaNode:', {
      id: node.id,
      type: node.type,
      data: node.data
    });

    // Return the node
    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error getting MetaNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get MetaNode' },
      { status: 500 }
    );
  }
}

// PATCH /api/graph/meta/[id] - Update a meta node by ID
export async function PATCH(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Updating MetaNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updateData = await request.json();
    
    // Check if the node exists first
    const node = await neo4jStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] MetaNode not found for update:', id);
      return NextResponse.json(
        { error: 'MetaNode not found' },
        { status: 404 }
      );
    }

    // Use the Neo4j storage's updateNode method
    const updatedNode = await neo4jStorage.updateNode(id, updateData);
    
    console.log('[API] Successfully updated MetaNode:', {
      id: updatedNode.id,
      type: updatedNode.type,
      data: updatedNode.data
    });

    // Return the updated node
    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating MetaNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update MetaNode' },
      { status: 500 }
    );
  }
}

// DELETE /api/graph/meta/[id] - Delete a meta node by ID
export async function DELETE(request: NextRequest) {
  try {
    // Get ID from URL instead of params
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];

    console.log('[API] Deleting MetaNode by ID:', id);
    
    if (!id) {
      console.warn('[API] Missing required path parameter: id');
      return NextResponse.json(
        { error: 'Missing required path parameter: id' },
        { status: 400 }
      );
    }

    // Check if the node exists first
    const node = await neo4jStorage.getNode(id);
    
    if (!node) {
      console.warn('[API] MetaNode not found for deletion:', id);
      return NextResponse.json(
        { error: 'MetaNode not found' },
        { status: 404 }
      );
    }

    // Use the Neo4j storage's deleteNode method
    await neo4jStorage.deleteNode(id);
    
    console.log('[API] Successfully deleted MetaNode:', id);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting MetaNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Check if it's a Neo4j-specific error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete MetaNode' },
      { status: 500 }
    );
  }
}
