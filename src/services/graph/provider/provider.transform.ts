import { RFProviderNode, RFProviderNodeData, Neo4jProviderNodeData, RFProviderEdge, Neo4jProviderEdge, ProviderCost, DDItem, TeamAllocation } from '@/services/graph/provider/provider.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

/**
 * Helper function to safely parse JSON strings
 * @param jsonString The string to parse as JSON
 * @param defaultValue The default value to return if parsing fails
 * @returns The parsed JSON object or the default value
 */
function safeJsonParse<T>(jsonString: string | undefined, defaultValue: T): T {
  console.log('🔍 safeJsonParse called with:', { 
    jsonString, 
    type: typeof jsonString,
    defaultValueType: typeof defaultValue,
    isDefaultArray: Array.isArray(defaultValue)
  });
  
  // If it's already the correct type, return it directly
  if (typeof jsonString !== 'string') {
    if (Array.isArray(defaultValue) && Array.isArray(jsonString)) {
      console.log('✅ safeJsonParse: Input is already an array, returning directly');
      return jsonString as unknown as T;
    }
    console.log('⚠️ safeJsonParse: Input is not a string and not matching default type, returning default', {
      inputType: typeof jsonString,
      defaultType: typeof defaultValue
    });
    return defaultValue;
  }
  
  if (!jsonString || jsonString.trim() === '') {
    console.log('⚠️ safeJsonParse: Empty string provided', { jsonString });
    return defaultValue;
  }
  
  // Check if the string is a valid JSON before attempting to parse
  if (!jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
    console.warn('⚠️ safeJsonParse: Invalid JSON format', { 
      jsonString, 
      type: typeof jsonString,
      firstChar: jsonString.trim()[0] || 'empty string'
    });
    return defaultValue;
  }
  
  try {
    const parsed = JSON.parse(jsonString) as T;
    console.log('✅ safeJsonParse: Successfully parsed JSON', { 
      parsed,
      type: typeof parsed,
      isArray: Array.isArray(parsed),
      length: Array.isArray(parsed) ? parsed.length : undefined
    });
    
    // Ensure we return an array if the default is an array
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
      console.warn('⚠️ safeJsonParse: Parsed result is not an array but default is, returning default');
      return defaultValue;
    }
    
    return parsed;
  } catch (e) {
    console.warn('❌ safeJsonParse: Failed to parse JSON string:', e, { jsonString });
    return defaultValue;
  }
}

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
  // Add a very visible debug log
  console.log('🔍 NEO4J TO REACT FLOW TRANSFORM:', { 
    id: neo4jData.id,
    costs: neo4jData.costs,
    ddItems: neo4jData.ddItems,
    teamAllocations: neo4jData.teamAllocations
  });

  // Parse JSON strings back to objects using the safe parser
  const costs = safeJsonParse<ProviderCost[]>(neo4jData.costs, []);
  const ddItems = safeJsonParse<DDItem[]>(neo4jData.ddItems, []);
  
  // Enhanced handling for teamAllocations to ensure it's always an array
  let teamAllocations: TeamAllocation[] = [];
  
  // If it's already an array, use it directly
  if (Array.isArray(neo4jData.teamAllocations)) {
    console.log('✅ teamAllocations is already an array:', neo4jData.teamAllocations);
    teamAllocations = neo4jData.teamAllocations;
  }
  // If it's a string, try to parse it
  else if (typeof neo4jData.teamAllocations === 'string') {
    try {
      const parsed = JSON.parse(neo4jData.teamAllocations);
      if (Array.isArray(parsed)) {
        console.log('✅ Successfully parsed teamAllocations string to array:', parsed);
        teamAllocations = parsed;
      } else {
        console.warn('⚠️ Parsed teamAllocations is not an array, using empty array instead');
      }
    } catch (e) {
      console.warn('❌ Failed to parse teamAllocations string, using empty array instead:', e);
    }
  } else {
    console.log('⚠️ teamAllocations is neither an array nor a string, using empty array');
  }
  
  console.log('🔄 Final teamAllocations after transformation:', {
    teamAllocations,
    isArray: Array.isArray(teamAllocations),
    length: teamAllocations.length
  });

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
  console.log('🔍 transformProviderNode called with node:', { 
    id: node?.properties?.id,
    labels: node?.labels,
    hasProperties: !!node?.properties,
    propertyKeys: node?.properties ? Object.keys(node.properties) : []
  });
  
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

  console.log('🔍 Provider node properties extracted:', { 
    id,
    costs,
    costsType: typeof costs,
    ddItems,
    ddItemsType: typeof ddItems,
    teamAllocations,
    teamAllocationsType: typeof teamAllocations,
    otherProperties: Object.keys(properties)
  });

  // Parse JSON strings back to objects using the safe parser
  const costsData = safeJsonParse<ProviderCost[]>(costs as string, []);
  const ddItemsData = safeJsonParse<DDItem[]>(ddItems as string, []);
  
  // Enhanced handling for teamAllocations to ensure it's always an array
  let teamAllocationsData: TeamAllocation[] = [];
  
  // If it's already an array, use it directly
  if (Array.isArray(teamAllocations)) {
    console.log('✅ teamAllocations is already an array:', teamAllocations);
    teamAllocationsData = teamAllocations as TeamAllocation[];
  }
  // If it's a string, try to parse it
  else if (typeof teamAllocations === 'string') {
    try {
      const parsed = JSON.parse(teamAllocations);
      if (Array.isArray(parsed)) {
        console.log('✅ Successfully parsed teamAllocations string to array:', parsed);
        teamAllocationsData = parsed;
      } else {
        console.warn('⚠️ Parsed teamAllocations is not an array, using empty array instead');
      }
    } catch (e) {
      console.warn('❌ Failed to parse teamAllocations string, using empty array instead:', e);
    }
  } else {
    console.log('⚠️ teamAllocations is neither an array nor a string, using empty array');
  }
  
  console.log('🔄 Final teamAllocations after transformation:', {
    teamAllocationsData,
    isArray: Array.isArray(teamAllocationsData),
    length: teamAllocationsData.length
  });

  console.log('🔍 Provider node data after parsing:', { 
    costsData,
    costsDataType: typeof costsData,
    costsIsArray: Array.isArray(costsData),
    costsLength: Array.isArray(costsData) ? costsData.length : undefined,
    ddItemsData,
    ddItemsDataType: typeof ddItemsData,
    ddItemsIsArray: Array.isArray(ddItemsData),
    ddItemsLength: Array.isArray(ddItemsData) ? ddItemsData.length : undefined,
    teamAllocationsData,
    teamAllocationsDataType: typeof teamAllocationsData,
    teamAllocationsIsArray: Array.isArray(teamAllocationsData),
    teamAllocationsLength: Array.isArray(teamAllocationsData) ? teamAllocationsData.length : undefined
  });

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