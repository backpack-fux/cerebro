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
  'feature': new FeatureService(neo4jStorage as IGraphStorage<RFFeatureNodeData>),
  'team': new TeamService(neo4jStorage as IGraphStorage<RFTeamNodeData>),
  'teamMember': new TeamMemberService(neo4jStorage as IGraphStorage<RFTeamMemberNodeData>),
  'provider': new ProviderService(neo4jStorage as IGraphStorage<RFProviderNodeData>),
  'option': new OptionService(neo4jStorage as IGraphStorage<RFOptionNodeData>),
  //'calendar': new CalendarService(neo4jStorage as IGraphStorage<RFCalendarNodeData>),
  //'code': new CodeService(neo4jStorage as IGraphStorage<RFCodeNodeData>),
  //'notes': new NotesService(neo4jStorage as IGraphStorage<RFNotesNodeData>),
};

export function getNodeService(nodeType: string): NodeService | null {
  const service = nodeServiceRegistry[nodeType as keyof typeof nodeServiceRegistry];
  if (!service) {
    console.warn(`No service registered for node type: ${nodeType}`);
    return null;
  }
  return service as NodeService;
}