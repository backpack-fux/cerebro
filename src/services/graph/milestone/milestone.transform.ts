import { RFMilestoneNode, RFMilestoneNodeData, Neo4jMilestoneNodeData, RFMilestoneEdge, Neo4jMilestoneEdge, FeatureAllocationSummary, OptionRevenueSummary, ProviderCostSummary } from '@/services/graph/milestone/milestone.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { parseDataFromBackend } from '@/lib/utils';

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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
  const parsedData = parseDataFromBackend(neo4jData, jsonFields);
  
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
  if (!node?.properties) return null;

  const type = node.labels[0]?.toLowerCase() as 'milestone';
  if (type !== 'milestone') return null;

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
  
  // Parse KPIs from JSON string if available
  const parsedKpis = kpis ? JSON.parse(kpis as string) : undefined;
  
  // Parse feature allocations from JSON string if available
  let parsedFeatureAllocations: FeatureAllocationSummary[] = [];
  if (featureAllocations) {
    try {
      if (typeof featureAllocations === 'string') {
        parsedFeatureAllocations = JSON.parse(featureAllocations as string);
        console.log('[Transform] Successfully parsed featureAllocations:', parsedFeatureAllocations);
      } else if (Array.isArray(featureAllocations)) {
        parsedFeatureAllocations = featureAllocations as unknown as FeatureAllocationSummary[];
      }
    } catch (error) {
      console.error('Error parsing featureAllocations JSON:', error, { featureAllocations });
    }
  }
  
  // Parse option details from JSON string if available
  let parsedOptionDetails: OptionRevenueSummary[] = [];
  if (optionDetails) {
    try {
      if (typeof optionDetails === 'string') {
        parsedOptionDetails = JSON.parse(optionDetails as string);
        console.log('[Transform] Successfully parsed optionDetails:', parsedOptionDetails);
      } else if (Array.isArray(optionDetails)) {
        parsedOptionDetails = optionDetails as unknown as OptionRevenueSummary[];
      }
    } catch (error) {
      console.error('Error parsing optionDetails JSON:', error, { optionDetails });
    }
  }
  
  // Parse provider details from JSON string if available
  let parsedProviderDetails: ProviderCostSummary[] = [];
  if (providerDetails) {
    try {
      if (typeof providerDetails === 'string') {
        parsedProviderDetails = JSON.parse(providerDetails as string);
        console.log('[Transform] Successfully parsed providerDetails:', parsedProviderDetails);
      } else if (Array.isArray(providerDetails)) {
        parsedProviderDetails = providerDetails as unknown as ProviderCostSummary[];
      }
    } catch (error) {
      console.error('Error parsing providerDetails JSON:', error, { providerDetails });
    }
  }

  return {
    id: id as string, // Use the ID directly from Neo4j without adding a prefix
    type,
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      title: properties.title as string,
      description: properties.description as string | undefined,
      status: properties.status as string | undefined,
      kpis: parsedKpis,
      name: properties.name as string,
      createdAt: properties.createdAt as string,
      updatedAt: properties.updatedAt as string,
      // Add cost and revenue data
      totalCost: properties.totalCost as number | undefined,
      monthlyValue: properties.monthlyValue as number | undefined,
      teamCosts: properties.teamCosts as number | undefined,
      providerCosts: properties.providerCosts as number | undefined,
      featureAllocations: parsedFeatureAllocations,
      optionDetails: parsedOptionDetails,
      providerDetails: parsedProviderDetails
    } as RFMilestoneNodeData,
  };
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