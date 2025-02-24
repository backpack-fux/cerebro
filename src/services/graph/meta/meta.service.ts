// meta.service.ts
import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFMetaNode, RFMetaNodeData, CreateMetaNodeParams, UpdateMetaNodeParams, RFMetaEdge } from '@/services/graph/meta/meta.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge } from '@/services/graph/meta/meta.transform';

export class MetaService {
  constructor(private storage: IGraphStorage<RFMetaNodeData>) {}

  async create(params: CreateMetaNodeParams): Promise<RFMetaNode> {
    const node: RFMetaNode = {
      id: crypto.randomUUID(),
      type: 'meta',
      position: params.position,
      data: {
        title: params.title,
        description: params.description || '',
        name: params.title, // Default name to title
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    return this.storage.createNode('meta', node.data) as Promise<RFMetaNode>;
  }

  async update(params: UpdateMetaNodeParams): Promise<RFMetaNode> {
    const { id, ...updateData } = params;
    return this.storage.updateNode(id, updateData as Partial<RFMetaNodeData>) as Promise<RFMetaNode>;
  }

  async delete(id: string): Promise<void> {
    return this.storage.deleteNode(id);
  }

  // Edge operations
  async createEdge(edge: RFMetaEdge): Promise<RFMetaEdge> {
    const graphEdge = reactFlowToNeo4jEdge(edge);
    const result = await this.storage.createEdge(graphEdge);
    return neo4jToReactFlowEdge(result);
  }

  async getEdges(nodeId: string, type?: string): Promise<RFMetaEdge[]> {
    const edges = await this.storage.getEdges(nodeId, type);
    return edges.map(edge => neo4jToReactFlowEdge(edge));
  }

  async getEdge(edgeId: string): Promise<RFMetaEdge | null> {
    const edge = await this.storage.getEdge(edgeId);
    return edge ? neo4jToReactFlowEdge(edge) : null;
  }

  async updateEdge(edgeId: string, properties: Partial<RFMetaEdge['data']>): Promise<RFMetaEdge> {
    const result = await this.storage.updateEdge(edgeId, properties);
    return neo4jToReactFlowEdge(result);
  }

  async deleteEdge(edgeId: string): Promise<void> {
    return this.storage.deleteEdge(edgeId);
  }


}