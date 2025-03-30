import { SynapsoTeamNode } from "./synapso-team-node";
import { SynapsoLogicNode } from "./synapso-logic-node";
import { SynapsoTeamMemberNode } from "./synapso-team-member-node";

// Legacy node types (to be migrated to Synapso)
// Commented out until migrated to prevent errors
/*
import { MetaNode } from "./meta-node";
import { MilestoneNode } from "./milestone-node";
import { FeatureNode } from "./feature-node";
import { TeamMemberNode } from "./team-member-node";
import { ProviderNode } from "./provider-node";
import { OptionNode } from "./option-node";
import { CalendarNode } from "./calendar-node";
import { CodeNode } from "./code-node";
import { NotesNode } from "./notes-node";
*/

// Node types registry
export const nodeTypes = {
  // Synapso node types (new)
  synapsoTeam: SynapsoTeamNode,
  synapsoLogic: SynapsoLogicNode,
  synapsoTeamMember: SynapsoTeamMemberNode,
  
  // Legacy node types are commented out until migrated
  // Uncomment each as they are migrated to Synapso
  /*
  meta: MetaNode,
  milestone: MilestoneNode,
  feature: FeatureNode,
  teamMember: TeamMemberNode,
  provider: ProviderNode,
  option: OptionNode,
  calendar: CalendarNode,
  code: CodeNode,
  notes: NotesNode,
  */
} as const;

export type NodeTypes = typeof nodeTypes;