// node-service-registry.ts
import { MetaService } from '@/services/graph/meta/meta.service';
import { MilestoneService } from '@/services/graph/milestone/milestone.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { TeamMemberService } from '@/services/graph/team-member/team-member.service';
import { RFTeamMemberNodeData } from '@/services/graph/team-member/team-member.types';
import { FeatureService } from '../feature/feature.service';
import { TeamService } from '../team/team.service';
import { RFFeatureNodeData } from '@/services/graph/feature/feature.types';
import { RFTeamNodeData } from '@/services/graph/team/team.types';
import { ProviderService } from '../provider/provider.service';
import { RFProviderNodeData } from '@/services/graph/provider/provider.types';
import { RFOptionNodeData } from '../option/option.types';
import { OptionService } from '../option/option.service';

/**
 * Base interface for node services with common functionality
 * We use a more generic approach to accommodate various service implementations
 */
interface NodeService {
  create(params: unknown): Promise<unknown>;
  update(params: unknown): Promise<unknown>;
  delete(id: string): Promise<void>;
  createEdge(edge: unknown): Promise<unknown>;
  deleteEdge(id: string): Promise<void>;
  getNode?(id: string): Promise<unknown | null>;
}

// Type-safe registry of node services
export const nodeServiceRegistry = {
  'meta': new MetaService(neo4jStorage as IGraphStorage<RFMetaNodeData>),
  'milestone': new MilestoneService(neo4jStorage as IGraphStorage<RFMilestoneNodeData>),
  'feature': new FeatureService(neo4jStorage as IGraphStorage<RFFeatureNodeData>),
  'team': new TeamService(neo4jStorage as IGraphStorage<RFTeamNodeData>),
  'teamMember': new TeamMemberService(neo4jStorage as IGraphStorage<RFTeamMemberNodeData>),
  'provider': new ProviderService(neo4jStorage as IGraphStorage<RFProviderNodeData>),
  'option': new OptionService(neo4jStorage as IGraphStorage<RFOptionNodeData>),
  //'calendar': new CalendarService(neo4jStorage as IGraphStorage<RFCalendarNodeData>),
  //'code': new CodeService(neo4jStorage as IGraphStorage<RFCodeNodeData>),
  //'notes': new NotesService(neo4jStorage as IGraphStorage<RFNotesNodeData>),
} as const;

// Define the valid node types based on the registry keys
export type ValidNodeType = keyof typeof nodeServiceRegistry;

/**
 * Get a node service by type
 * @param nodeType The type of node service to retrieve
 * @returns The node service or null if not found
 */
export function getNodeService(nodeType: string): NodeService | null {
  // Check if nodeType is a valid key in the registry
  if (!Object.keys(nodeServiceRegistry).includes(nodeType)) {
    console.warn(`No service registered for node type: ${nodeType}`);
    return null;
  }
  
  // Since all services follow a similar interface pattern, we can cast to NodeService
  // Each specific service will have strongly typed methods internally
  return nodeServiceRegistry[nodeType as ValidNodeType] as unknown as NodeService;
}