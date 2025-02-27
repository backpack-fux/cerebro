// neo4j.provider.ts
import { Neo4jGraphStorage } from './neo4j.service';
import { Neo4jConfig, neo4jConfig } from './neo4j.configs';
import { GraphEdge, GraphNode, IGraphStorage } from './graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { NodeType } from '../base-node/reactflow.types';

// Import node services
import { MetaService } from '@/services/graph/meta/meta.service';
import { MilestoneService } from '@/services/graph/milestone/milestone.service';
import { TeamMemberService } from '@/services/graph/team-member/team-member.service';
import { TeamService } from '@/services/graph/team/team.service';
import { FeatureService } from '@/services/graph/feature/feature.service';
import { OptionService } from '@/services/graph/option/option.service';
import { ProviderService } from '@/services/graph/provider/provider.service';

// Import node types
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { RFTeamMemberNodeData } from '@/services/graph/team-member/team-member.types';
import { RFTeamNodeData } from '@/services/graph/team/team.types';
import { RFFeatureNodeData } from '@/services/graph/feature/feature.types';
import { RFOptionNodeData } from '@/services/graph/option/option.types';
import { RFProviderNodeData } from '@/services/graph/provider/provider.types';

// Import transform functions
import { transformMetaNode, transformMetaEdge } from '@/services/graph/meta/meta.transform';
import { transformMilestoneNode, transformMilestoneEdge } from '@/services/graph/milestone/milestone.transform';
import { transformTeamMemberNode, transformTeamMemberEdge } from '@/services/graph/team-member/team-member.transform';
import { transformTeamNode, transformTeamEdge } from '@/services/graph/team/team.transform';
import { transformFeatureNode, transformFeatureEdge } from '@/services/graph/feature/feature.transform';
import { transformOptionNode, transformOptionEdge } from '@/services/graph/option/option.transform';
import { transformProviderNode, transformProviderEdge } from '@/services/graph/provider/provider.transform';

// Generic transform functions for any node/edge type (could be dynamic or default)
function transformNode(node: Neo4jNode): GraphNode<any> | null {
  if (!node?.properties) return null;

  // Get the raw type from Neo4j
  let type = node.labels[0]?.toLowerCase() as NodeType;
  if (!type) return null;

  // Map database node types to API node types
  // This ensures consistency between database labels and API URLs
  if (type === 'team_member' || type === 'teammember') {
    type = 'teamMember';
  }
  // Add other mappings as needed for other node types
  
  const { positionX, positionY, id, ...properties } = node.properties;

  return {
    id: id as string,
    type,
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: properties as any, // Generic, could be refined with dynamic type detection
  };
}

function transformEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  return {
    id: relationship.properties.id as string || `edge-${crypto.randomUUID()}`,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: relationship.properties || {},
  };
}

// Factory function for creating Neo4j storage
export function createNeo4jStorage<T>(
  config: Neo4jConfig,
  transformNode: (node: Neo4jNode) => GraphNode<T> | null,
  transformEdge: (relationship: Neo4jRelationship, sourceId?: string, targetId?: string) => GraphEdge | null
): IGraphStorage<T> {
  return new Neo4jGraphStorage<T>(config, transformNode, transformEdge);
}

// Create a generic Neo4j storage instance
export const neo4jStorage = createNeo4jStorage<any>(
  neo4jConfig,
  transformNode,
  transformEdge
);

// Factory functions for creating service instances
export function createMetaService(storage: IGraphStorage<RFMetaNodeData>): MetaService {
  return new MetaService(storage);
}

export function createMilestoneService(storage: IGraphStorage<RFMilestoneNodeData>): MilestoneService {
  return new MilestoneService(storage);
}

export function createTeamMemberService(storage: IGraphStorage<RFTeamMemberNodeData>): TeamMemberService {
  return new TeamMemberService(storage);
}

export function createTeamService(storage: IGraphStorage<RFTeamNodeData>): TeamService {
  return new TeamService(storage);
}

export function createFeatureService(storage: IGraphStorage<RFFeatureNodeData>): FeatureService {
  return new FeatureService(storage);
}

export function createOptionService(storage: IGraphStorage<RFOptionNodeData>): OptionService {
  return new OptionService(storage);
}

export function createProviderService(storage: IGraphStorage<RFProviderNodeData>): ProviderService {
  return new ProviderService(storage);
}

// Create service instances with the generic Neo4j storage
export const metaService = createMetaService(neo4jStorage as IGraphStorage<RFMetaNodeData>);
export const milestoneService = createMilestoneService(neo4jStorage as IGraphStorage<RFMilestoneNodeData>);
export const teamMemberService = createTeamMemberService(neo4jStorage as IGraphStorage<RFTeamMemberNodeData>);
export const teamService = createTeamService(neo4jStorage as IGraphStorage<RFTeamNodeData>);
export const featureService = createFeatureService(neo4jStorage as IGraphStorage<RFFeatureNodeData>);
export const optionService = createOptionService(neo4jStorage as IGraphStorage<RFOptionNodeData>);
export const providerService = createProviderService(neo4jStorage as IGraphStorage<RFProviderNodeData>);

// Create specialized Neo4j storage instances for each node type
export function createMetaStorage(): IGraphStorage<RFMetaNodeData> {
  return createNeo4jStorage<RFMetaNodeData>(
    neo4jConfig,
    transformMetaNode,
    transformMetaEdge
  );
}

export function createMilestoneStorage(): IGraphStorage<RFMilestoneNodeData> {
  return createNeo4jStorage<RFMilestoneNodeData>(
    neo4jConfig,
    transformMilestoneNode,
    transformMilestoneEdge
  );
}

export function createTeamMemberStorage(): IGraphStorage<RFTeamMemberNodeData> {
  return createNeo4jStorage<RFTeamMemberNodeData>(
    neo4jConfig,
    transformTeamMemberNode,
    transformTeamMemberEdge
  );
}

export function createTeamStorage(): IGraphStorage<RFTeamNodeData> {
  return createNeo4jStorage<RFTeamNodeData>(
    neo4jConfig,
    transformTeamNode,
    transformTeamEdge
  );
}

export function createFeatureStorage(): IGraphStorage<RFFeatureNodeData> {
  return createNeo4jStorage<RFFeatureNodeData>(
    neo4jConfig,
    transformFeatureNode,
    transformFeatureEdge
  );
}

export function createOptionStorage(): IGraphStorage<RFOptionNodeData> {
  return createNeo4jStorage<RFOptionNodeData>(
    neo4jConfig,
    transformOptionNode,
    transformOptionEdge
  );
}

export function createProviderStorage(): IGraphStorage<RFProviderNodeData> {
  return createNeo4jStorage<RFProviderNodeData>(
    neo4jConfig,
    transformProviderNode,
    transformProviderEdge
  );
}