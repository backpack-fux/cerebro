import { MetaNode } from "./meta-node";
// ... other node imports ...

export type NodeTypes = {
  meta: typeof MetaNode;
  // ... other node types ...
};

export const nodeTypes = {
  meta: MetaNode,
  // ... other node types ...
};