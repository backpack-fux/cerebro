import { RFTeamNode, RFTeamNodeData, Neo4jTeamNodeData, RFTeamEdge, Neo4jTeamEdge, Season, RosterMember } from '@/services/graph/team/team.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

export function reactFlowToNeo4j(teamNode: RFTeamNode): Neo4jTeamNodeData {
  const data = teamNode.data as RFTeamNodeData; // Cast to ensure type safety
  
  // Check if season is already a string to prevent double serialization
  let seasonValue = undefined;
  if (data.season) {
    if (typeof data.season === 'string') {
      // If it's already a string, check if it's valid JSON
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(data.season);
        // If it parses successfully, use it as is
        seasonValue = data.season;
      } catch (e) {
        // If it's not valid JSON, stringify it
        seasonValue = JSON.stringify(data.season);
      }
    } else {
      // If it's an object, stringify it
      seasonValue = JSON.stringify(data.season);
    }
  }
  
  // Check if roster is already a string to prevent double serialization
  let rosterValue = undefined;
  if (data.roster) {
    if (typeof data.roster === 'string') {
      // If it's already a string, check if it's valid JSON
      try {
        // Try to parse it to validate it's proper JSON
        JSON.parse(data.roster);
        // If it parses successfully, use it as is
        rosterValue = data.roster;
      } catch (e) {
        // If it's not valid JSON, stringify it
        rosterValue = JSON.stringify(data.roster);
      }
    } else {
      // If it's an array, stringify it
      rosterValue = JSON.stringify(data.roster);
    }
  }
  
  return {
    id: teamNode.id, // Use React Flow's string ID
    name: data.title || 'Untitled Team', // Default fallback
    description: data.description,
    title: data.title,
    season: seasonValue,
    roster: rosterValue,
    createdAt: data.createdAt || new Date().toISOString(), // Default to now if not provided
    updatedAt: data.updatedAt || new Date().toISOString(), // Default to now if not provided
    positionX: teamNode.position.x,
    positionY: teamNode.position.y,
  };
}

export function neo4jToReactFlow(neo4jData: Neo4jTeamNodeData): RFTeamNode {
  // Explicitly parse JSON strings back to objects
  const season: Season | undefined = neo4jData.season
    ? typeof neo4jData.season === 'string'
      ? JSON.parse(neo4jData.season)
      : neo4jData.season
    : undefined;

  const roster: RosterMember[] = neo4jData.roster
    ? typeof neo4jData.roster === 'string'
      ? JSON.parse(neo4jData.roster)
      : neo4jData.roster
    : [];

  return {
    id: neo4jData.id,
    type: 'team',
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      description: neo4jData.description,
      name: neo4jData.name,
      season,
      roster,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
    } as RFTeamNodeData,
  };
}

export function reactFlowToNeo4jEdge(edge: RFTeamEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`, // Generate a unique ID if not provided
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() as 'TEAM_MEMBER' | 'TEAM_FEATURE' | string, // Convert to uppercase for Neo4j
    properties: {
      label: edge.data?.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allocation: edge.data?.allocation, // Include allocation if available
      // Add other metadata from edge.data as needed
    },
  };
}

export function neo4jToReactFlowEdge(neo4jEdge: Neo4jTeamEdge): RFTeamEdge {
  console.log('[Transform] Converting Neo4j team edge to React Flow edge:', {
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
      // Remove allocation from here since it's not in the RFTeamEdge data type
    },
  };
}

export function transformTeamNode(node: Neo4jNode): GraphNode<RFTeamNodeData> | null {
  if (!node?.properties) return null;

  // Check if this is a team node by looking at labels
  const type = node.labels.find(label => 
    label.toLowerCase() === 'team' || 
    label.toLowerCase() === 'team_node'
  )?.toLowerCase();
  
  if (!type) return null;

  const { positionX, positionY, id, season, roster, ...properties } = node.properties;

  // Parse JSON strings back to objects
  let seasonData: Season | undefined;
  let rosterData: RosterMember[] = [];

  try {
    if (season) {
      seasonData = JSON.parse(season as string) as Season;
    }
    if (roster) {
      rosterData = JSON.parse(roster as string) as RosterMember[];
    }
  } catch (error) {
    console.error('Error parsing JSON data from Neo4j:', error);
  }

  return {
    id: id as string,
    type: 'team', // Normalize to 'team' for frontend
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      title: properties.title as string,
      description: properties.description as string | undefined,
      name: properties.name as string,
      season: seasonData,
      roster: rosterData || [], // Default to empty array if parsing failed
      createdAt: properties.createdAt as string,
      updatedAt: properties.updatedAt as string,
    } as RFTeamNodeData,
  };
}

export function transformTeamEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const neo4jEdge: Neo4jTeamEdge = {
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