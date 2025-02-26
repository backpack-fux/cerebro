// node-service-registry.ts
import { MetaService } from '@/services/graph/meta/meta.service';
import { MilestoneService } from '@/services/graph/milestone/milestone.service';
import { neo4jStorage } from '@/services/graph/neo4j/neo4j.provider';
import { RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { RFMilestoneNodeData } from '@/services/graph/milestone/milestone.types';
import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { TeamMemberService } from '@/services/graph/team-member/team-member.service';
import { RFTeamMemberNodeData } from '@/services/graph/team-member/team-member.types';

interface NodeService {
  create(params: any): Promise<any>;
  update(params: any): Promise<any>;
  delete(id: string): Promise<void>;
  createEdge(edge: any): Promise<any>;
  deleteEdge(id: string): Promise<void>;
  getNode?(id: string): Promise<any | null>;
}

export const nodeServiceRegistry = {
  'meta': new MetaService(neo4jStorage as IGraphStorage<RFMetaNodeData>),
  'milestone': new MilestoneService(neo4jStorage as IGraphStorage<RFMilestoneNodeData>),
  //'feature': /* new FeatureService(neo4jStorage as IGraphStorage<FeatureNodeData>) */,
  //'team': /* new TeamService(neo4jStorage as IGraphStorage<TeamNodeData>) */,
  'teamMember': new TeamMemberService(neo4jStorage as IGraphStorage<RFTeamMemberNodeData>),
  //'provider': /* new ProviderService(neo4jStorage as IGraphStorage<ProviderNodeData>) */,
  //'option': /* new OptionService(neo4jStorage as IGraphStorage<OptionNodeData>) */,
  //'calendar': /* new CalendarService(neo4jStorage as IGraphStorage<CalendarNodeData>) */,
  //'code': /* new CodeService(neo4jStorage as IGraphStorage<CodeNodeData>) */,
  //'notes': /* new NotesService(neo4jStorage as IGraphStorage<NotesNodeData>) */,
  // Add more node types as needed
};

export function getNodeService(nodeType: string): NodeService | null {
  const service = nodeServiceRegistry[nodeType as keyof typeof nodeServiceRegistry];
  if (!service) {
    console.warn(`No service registered for node type: ${nodeType}`);
    return null;
  }
  return service as NodeService;
}