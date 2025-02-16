import type { Node } from "@xyflow/react";

export type NodeTypes = {
  text: typeof TextNode;
  // Add other node types here
};

export const nodeTypes: NodeTypes = {
  text: TextNode,
  // Add other node types here
};

// Your existing Node type (lines 2-7) should extend the React Flow Node type
export type MetaNode = {
  id: string;
  type: keyof NodeTypes;
  data: any;
  position: { x: number; y: number };
};


