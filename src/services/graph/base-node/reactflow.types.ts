// If you need dynamic properties, you can reintroduce Record<string, unknown> 
// or use a more specific type (e.g., Partial<Record<string, unknown>>) for optional extras.
export interface ReactFlowNodeBase extends Record<string, unknown> {
    /**
     * Display name of the node shown in the UI
     */
    name: string;
  
    /**
     * Detailed description of the node
     */
    description?: string;
  
    /**
     * Metadata timestamps for tracking node lifecycle
     * Stored as ISO strings for Neo4j compatibility
     */
    createdAt: string;
    updatedAt: string;
}

export type ReactFlowId = string;
export type NodeType = string;
export type RelationshipType = string;


