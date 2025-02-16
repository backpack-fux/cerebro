import { MetaNode } from "./meta-node";
import { MilestoneNode } from "./milestone-node";
import { FeatureNode } from "./feature-node";
import { TeamNode } from "./team-node";
import { TeamMemberNode } from "./team-member-node";
import { ProviderNode } from "./provider-node";
import { OptionNode } from "./option-node";
import { CalendarNode } from "./calendar-node";
import { CodeNode } from "./code-node";
import { NotesNode } from "./notes-node";
// ... other node imports ...

export const nodeTypes = {
  meta: MetaNode,
  milestone: MilestoneNode,
  feature: FeatureNode,
  team: TeamNode,
  teamMember: TeamMemberNode,
  provider: ProviderNode,
  option: OptionNode,
  calendar: CalendarNode,
  code: CodeNode,
  notes: NotesNode,
  // ... other node types ...
} as const;

export type NodeTypes = typeof nodeTypes;