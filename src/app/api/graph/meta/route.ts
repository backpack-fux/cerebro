// app/api/graph/meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { metaService } from '@/services/graph/neo4j/neo4j.provider';
import { CreateMetaNodeParams } from '@/services/graph/meta/meta.types';

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting MetaNode creation');
    const params: CreateMetaNodeParams = await req.json();
    if (!params.title || !params.position) {
      console.warn('[API] Invalid MetaNode creation request: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title and position are required' },
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
        code: (error as any).code,
        message: (error as any).message
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to create MetaNode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }

  // ... (similarly update PATCH, DELETE, and edge routes)
}