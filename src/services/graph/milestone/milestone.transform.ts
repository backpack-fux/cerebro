import { RFMilestoneNode, RFMilestoneNodeData, Neo4jMilestoneNodeData, RFMilestoneEdge, Neo4jMilestoneEdge, FeatureAllocationSummary, OptionRevenueSummary, ProviderCostSummary } from '@/services/graph/milestone/milestone.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { parseDataFromBackend } from '@/utils/utils';

export function reactFlowToNeo4j(milestoneNode: RFMilestoneNode): Neo4jMilestoneNodeData {
  const data = milestoneNode.data as RFMilestoneNodeData; // Cast to ensure type safety
  
  // Remove any 'milestone-' prefix from the ID if it exists
  // This ensures consistency with meta nodes which don't store the prefix
  const cleanId = milestoneNode.id.startsWith('milestone-') 
    ? milestoneNode.id.substring('milestone-'.length) 
    : milestoneNode.id;
  
  // Convert complex objects to JSON strings for Neo4j storage
  let featureAllocationsValue = undefined;
  if (data.featureAllocations) {
    if (typeof data.featureAllocations === 'string') {
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(data.featureAllocations);
        // If it parses successfully, use it as is
        featureAllocationsValue = data.featureAllocations;
      } catch {
        // If it fails to parse, stringify it
        featureAllocationsValue = JSON.stringify(data.featureAllocations);
      }
    } else {
      // If it's not a string, stringify it
      featureAllocationsValue = JSON.stringify(data.featureAllocations);
    }
  }
  
  // Convert option details to JSON string for Neo4j storage
  let optionDetailsValue = undefined;
  if (data.optionDetails) {
    if (typeof data.optionDetails === 'string') {
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(data.optionDetails);
        // If it parses successfully, use it as is
        optionDetailsValue = data.optionDetails;
      } catch {
        // If it fails to parse, stringify it
        optionDetailsValue = JSON.stringify(data.optionDetails);
      }
    } else {
      // If it's not a string, stringify it
      optionDetailsValue = JSON.stringify(data.optionDetails);
    }
  }
  
  // Convert provider details to JSON string for Neo4j storage
  let providerDetailsValue = undefined;
  if (data.providerDetails) {
    if (typeof data.providerDetails === 'string') {
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(data.providerDetails);
        // If it parses successfully, use it as is
        providerDetailsValue = data.providerDetails;
      } catch {
        // If it fails to parse, stringify it
        providerDetailsValue = JSON.stringify(data.providerDetails);
      }
    } else {
      // If it's not a string, stringify it
      providerDetailsValue = JSON.stringify(data.providerDetails);
    }
  }
  
  return {
    id: cleanId,
    title: data.title,
    description: data.description,
    status: data.status,
    name: data.name || data.title || 'Untitled Milestone',
    kpis: data.kpis ? JSON.stringify(data.kpis) : undefined,
    positionX: milestoneNode.position.x,
    positionY: milestoneNode.position.y,
    createdAt: data.createdAt,
    updatedAt: new Date().toISOString(),
    // Add cost and revenue data
    totalCost: data.totalCost,
    monthlyValue: data.monthlyValue,
    teamCosts: data.teamCosts,
    providerCosts: data.providerCosts,
    featureAllocations: featureAllocationsValue,
    optionDetails: optionDetailsValue,
    providerDetails: providerDetailsValue
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jMilestoneNodeData): RFMilestoneNode {
  console.log('[Transform] Converting Neo4j milestone to React Flow:', {
    id: neo4jData.id,
    title: neo4jData.title,
    featureAllocations: typeof neo4jData.featureAllocations === 'string' ? 'string' : typeof neo4jData.featureAllocations,
    optionDetails: typeof neo4jData.optionDetails === 'string' ? 'string' : typeof neo4jData.optionDetails,
    providerDetails: typeof neo4jData.providerDetails === 'string' ? 'string' : typeof neo4jData.providerDetails
  });

  // Define JSON fields that need special handling
  const jsonFields = ['kpis', 'featureAllocations', 'optionDetails', 'providerDetails'];
  
  // Parse all JSON fields
  const parsedData = parseDataFromBackend(neo4jData as unknown as Record<string, unknown>, jsonFields);
  
  return {
    id: neo4jData.id, // Use the ID directly without adding a prefix
    type: 'milestone', // Hardcoded for MilestoneNode
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      status: neo4jData.status,
      kpis: parsedData.kpis,
      name: neo4jData.name,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
      // Add cost and revenue data
      totalCost: neo4jData.totalCost,
      monthlyValue: neo4jData.monthlyValue,
      teamCosts: neo4jData.teamCosts,
      providerCosts: neo4jData.providerCosts,
      featureAllocations: parsedData.featureAllocations,
      optionDetails: parsedData.optionDetails,
      providerDetails: parsedData.providerDetails
    } as RFMilestoneNodeData,
    // Add any other properties needed for React Flow
  };
}

export function reactFlowToNeo4jEdge(edge: RFMilestoneEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() as 'DEPENDENCY' | 'RELATED' | string, // Convert to uppercase for Neo4j
    properties: {
      label: edge.data?.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Add other metadata from edge.data as needed
    },
  };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jMilestoneEdge): RFMilestoneEdge {
  console.log('[Transform] Converting Neo4j edge to React Flow edge:', {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  });
  
  return {
    id: neo4jEdge.id,
    source: neo4jEdge.from,
    target: neo4jEdge.to,
    type: 'default', // Use default edge type for ReactFlow
    data: {
      label: neo4jEdge.properties?.label,
      edgeType: neo4jEdge.type.toLowerCase(), // Store the original edge type in data
      // Add other metadata from neo4jEdge.properties as needed
    },
  };
}

export function transformMilestoneNode(node: Neo4jNode): GraphNode<RFMilestoneNodeData> | null {
  if (!node?.properties) {
    console.error('[Transform] Node has no properties:', node);
    return null;
  }

  try {
    const type = node.labels[0]?.toLowerCase() as 'milestone';
    if (type !== 'milestone') {
      console.warn('[Transform] Not a milestone node:', node.labels);
      return null;
    }

    const { 
      positionX, 
      positionY, 
      id, 
      kpis, 
      featureAllocations, 
      optionDetails,
      providerDetails,
      ...properties 
    } = node.properties;
    
    if (!id) {
      console.error('[Transform] Node missing id property:', node.properties);
      return null;
    }
    
    // Safely parse JSON fields with robust error handling
    const parseJsonSafely = <T>(jsonString: string | unknown, fieldName: string): T | undefined => {
      if (!jsonString) return undefined;
      
      try {
        if (typeof jsonString === 'string') {
          return JSON.parse(jsonString) as T;
        } else {
          return jsonString as T;
        }
      } catch (error) {
        console.error(`[Transform] Error parsing ${fieldName} JSON:`, error);
        return undefined;
      }
    };
    
    // Parse KPIs
    const parsedKpis = parseJsonSafely(kpis, 'kpis');
    
    // Parse feature allocations
    const parsedFeatureAllocations = parseJsonSafely<FeatureAllocationSummary[]>(
      featureAllocations, 'featureAllocations'
    ) || [];
    
    // Parse option details
    const parsedOptionDetails = parseJsonSafely<OptionRevenueSummary[]>(
      optionDetails, 'optionDetails'
    ) || [];
    
    // Parse provider details
    const parsedProviderDetails = parseJsonSafely<ProviderCostSummary[]>(
      providerDetails, 'providerDetails'
    ) || [];
    
    // Ensure position values are numeric
    const x = typeof positionX === 'number' ? positionX : 0;
    const y = typeof positionY === 'number' ? positionY : 0;

    return {
      id: id as string,
      type: 'milestone',
      position: { x, y },
      data: {
        // Using a type assertion here because Neo4j properties can contain various types
        // that we need to include in the node data. This is safe because we're doing proper
        // validation of specific fields above and handling the complex nested objects properly.
        ...(properties as Record<string, unknown>),
        kpis: parsedKpis,
        featureAllocations: parsedFeatureAllocations,
        optionDetails: parsedOptionDetails,
        providerDetails: parsedProviderDetails,
        // Ensure critical properties are always present
        title: properties.title as string || 'Untitled Milestone',
        name: properties.name as string || properties.title as string || 'Untitled Milestone',
        description: properties.description as string || '',
        createdAt: properties.createdAt as string || new Date().toISOString(),
        updatedAt: properties.updatedAt as string || new Date().toISOString(),
      } as RFMilestoneNodeData,
    };
  } catch (error) {
    console.error('[Transform] Error transforming milestone node:', error);
    return null;
  }
}

export function transformMilestoneEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jMilestoneEdge = {
    id: relationship.properties.id as string,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: {
      label: relationship.properties.label as string | undefined,
      createdAt: relationship.properties.createdAt as string | undefined,
      updatedAt: relationship.properties.updatedAt as string | undefined,
    },
  };

  // Convert to GraphEdge
  return {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  };
} 