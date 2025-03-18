// app/api/graph/meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { metaService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateMetaNodeParams, UpdateMetaNodeParams } from '@/services/graph/meta/meta.types';

interface Neo4jError {
  code: string;
  message: string;
}

/**
 * Validates a CreateMetaNodeParams object
 * @param params The parameters to validate
 * @returns True if valid, false otherwise
 */
function isValidCreateMetaNodeParams(params: unknown): params is CreateMetaNodeParams {
  return (
    params !== null &&
    typeof params === 'object' &&
    'title' in params &&
    'position' in params &&
    typeof (params as CreateMetaNodeParams).title === 'string' &&
    typeof (params as CreateMetaNodeParams).position === 'object' &&
    typeof (params as CreateMetaNodeParams).position.x === 'number' &&
    typeof (params as CreateMetaNodeParams).position.y === 'number'
  );
}

/**
 * Validates an UpdateMetaNodeParams object
 * @param params The parameters to validate
 * @returns True if valid, false otherwise
 */
function isValidUpdateMetaNodeParams(params: unknown): params is UpdateMetaNodeParams {
  return (
    params !== null &&
    typeof params === 'object' &&
    'id' in params &&
    typeof (params as UpdateMetaNodeParams).id === 'string'
  );
}

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting MetaNode creation');
    const params = await req.json();
    
    if (!isValidCreateMetaNodeParams(params)) {
      console.warn('[API] Invalid MetaNode creation request: Invalid parameters');
      return NextResponse.json(
        { error: 'Invalid parameters: title and position are required' },
        { status: 400 }
      );
    }

    console.log('[API] Received MetaNode creation request:', {
      title: params.title,
      description: params.description,
      position: params.position,
    });

    const node = await metaService.create(params);
    console.log('[API] Successfully created MetaNode:', {
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        title: node.data.title,
        description: node.data.description,
        name: node.data.name,
      }
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating MetaNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create MetaNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    console.log('[API] Starting MetaNode update');
    const params = await req.json();
    
    if (!isValidUpdateMetaNodeParams(params)) {
      console.warn('[API] Invalid MetaNode update request: Invalid parameters');
      return NextResponse.json(
        { error: 'Invalid parameters: id is required' },
        { status: 400 }
      );
    }

    console.log('[API] Received MetaNode update request:', {
      id: params.id,
      title: params.title,
      description: params.description,
      position: params.position,
    });

    const node = await metaService.update(params);
    console.log('[API] Successfully updated MetaNode:', {
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        title: node.data.title,
        description: node.data.description,
        name: node.data.name,
      }
    });

    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error updating MetaNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to update MetaNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      console.warn('[API] Invalid MetaNode deletion request: Missing id');
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    console.log('[API] Received MetaNode deletion request:', { id });
    await metaService.delete(id);
    console.log('[API] Successfully deleted MetaNode:', { id });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[API] Error deleting MetaNode:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[API] Neo4j error details:', {
        code: (error as Neo4jError).code,
        message: (error as Neo4jError).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete MetaNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}