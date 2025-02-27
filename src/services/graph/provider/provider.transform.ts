import { RFProviderNode, RFProviderNodeData, Neo4jProviderNodeData, RFProviderEdge, Neo4jProviderEdge, ProviderCost, DDItem, TeamAllocation } from '@/services/graph/provider/provider.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function reactFlowToNeo4j(providerNode: RFProviderNode): Neo4jProviderNodeData {
  const data = providerNode.data as RFProviderNodeData; // Cast to ensure type safety
  return {
    id: providerNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Provider', // Default fallback
    description: data.description,
    title: data.title,
    duration: data.duration,
    costs: data.costs ? JSON.stringify(data.costs) : undefined,
    ddItems: data.ddItems ? JSON.stringify(data.ddItems) : undefined,
    teamAllocations: data.teamAllocations ? JSON.stringify(data.teamAllocations) : undefined,
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: providerNode.position.x,
    positionY: providerNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jProviderNodeData): RFProviderNode {
  // Parse JSON strings back to objects
  let costs: ProviderCost[] = [];
  let ddItems: DDItem[] = [];
  let teamAllocations: TeamAllocation[] = [];

  try {
    if (neo4jData.costs) {
      try {
        const parsedCosts = JSON.parse(neo4jData.costs);
        costs = Array.isArray(parsedCosts) ? parsedCosts : [];
      } catch (e) {
        console.warn('Failed to parse costs string:', e);
      }
    }
    if (neo4jData.ddItems) {
      try {
        const parsedDDItems = JSON.parse(neo4jData.ddItems);
        ddItems = Array.isArray(parsedDDItems) ? parsedDDItems : [];
      } catch (e) {
        console.warn('Failed to parse ddItems string:', e);
      }
    }
    if (neo4jData.teamAllocations) {
      try {
        const parsedTeamAllocations = JSON.parse(neo4jData.teamAllocations);
        teamAllocations = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
      }
    }
  } catch (error) {
    console.error('Error in neo4jToReactFlow:', error);
  }

  return {
    id: neo4jData.id,
    type: 'provider', // Hardcoded for ProviderNode
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      name: neo4jData.name,
      duration: neo4jData.duration,
      costs: costs,
      ddItems: ddItems,
      teamAllocations: teamAllocations,
      status: neo4jData.status,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
    } as RFProviderNodeData,
  };
}

export function reactFlowToNeo4jEdge(edge: RFProviderEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() as 'PROVIDER_TEAM' | 'PROVIDER_FEATURE' | 'PROVIDER_DEPENDENCY' | string, // Convert to uppercase for Neo4j
    properties: {
      label: edge.data?.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allocation: edge.data?.allocation, // Include allocation if available
      // Add other metadata from edge.data as needed
    },
  };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jProviderEdge): RFProviderEdge {
  console.log('[Transform] Converting Neo4j provider edge to React Flow edge:', {
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
      allocation: neo4jEdge.properties?.allocation, // Include allocation if available
    },
  };
}

export function transformProviderNode(node: Neo4jNode): GraphNode<RFProviderNodeData> | null {
  if (!node?.properties) return null;

  // Check if this is a provider node by looking at labels
  const type = node.labels.find(label => 
    label.toLowerCase() === 'provider' || 
    label.toLowerCase() === 'provider_node'
  )?.toLowerCase();
  
  if (!type) return null;

  const { 
    positionX, 
    positionY, 
    id, 
    costs, 
    ddItems, 
    teamAllocations, 
    ...properties 
  } = node.properties;

  // Parse JSON strings back to objects
  let costsData: ProviderCost[] = [];
  let ddItemsData: DDItem[] = [];
  let teamAllocationsData: TeamAllocation[] = [];

  try {
    if (costs) {
      try {
        const parsedCosts = JSON.parse(costs as string);
        costsData = Array.isArray(parsedCosts) ? parsedCosts : [];
      } catch (e) {
        console.warn('Failed to parse costs string:', e);
      }
    }
    if (ddItems) {
      try {
        const parsedDDItems = JSON.parse(ddItems as string);
        ddItemsData = Array.isArray(parsedDDItems) ? parsedDDItems : [];
      } catch (e) {
        console.warn('Failed to parse ddItems string:', e);
      }
    }
    if (teamAllocations) {
      try {
        const parsedTeamAllocations = JSON.parse(teamAllocations as string);
        teamAllocationsData = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
      }
    }
  } catch (error) {
    console.error('Error in transformProviderNode:', error);
  }

  return {
    id: id as string,
    type: 'provider', // Normalize to 'provider' for frontend
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      title: properties.title as string,
      description: properties.description as string | undefined,
      name: properties.name as string,
      duration: properties.duration as number | undefined,
      costs: costsData,
      ddItems: ddItemsData,
      teamAllocations: teamAllocationsData,
      status: properties.status as string | undefined,
      createdAt: properties.createdAt as string,
      updatedAt: properties.updatedAt as string,
    } as RFProviderNodeData,
  };
}

export function transformProviderEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jProviderEdge = {
    id: relationship.properties.id as string,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: {
      label: relationship.properties.label as string | undefined,
      createdAt: relationship.properties.createdAt as string | undefined,
      updatedAt: relationship.properties.updatedAt as string | undefined,
      allocation: relationship.properties.allocation as number | undefined,
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