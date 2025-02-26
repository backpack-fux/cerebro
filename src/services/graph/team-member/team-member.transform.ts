import { RFTeamMemberEdge, Neo4jTeamMemberEdge, TeamMemberSummary, RFTeamMemberNode, RFTeamMemberNodeData, Neo4jTeamMemberNodeData } from './team-member.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';

/**
 * Transform a ReactFlow node to a Neo4j node
 */
export function reactFlowToNeo4j(teamMemberNode: RFTeamMemberNode): Neo4jTeamMemberNodeData {
  const data = teamMemberNode.data as RFTeamMemberNodeData;
  
  return {
    id: teamMemberNode.id,
    name: data.title || 'Untitled Team Member',
    title: data.title,
    roles: JSON.stringify(data.roles || []),
    bio: data.bio,
    timezone: data.timezone,
    dailyRate: data.dailyRate,
    hoursPerDay: data.hoursPerDay,
    daysPerWeek: data.daysPerWeek,
    weeklyCapacity: data.weeklyCapacity,
    startDate: data.startDate,
    skills: data.skills ? JSON.stringify(data.skills) : undefined,
    teamId: data.teamId,
    allocation: data.allocation,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    positionX: teamMemberNode.position.x,
    positionY: teamMemberNode.position.y,
  };
}

/**
 * Transform a Neo4j node to a ReactFlow node
 */
export function neo4jToReactFlow(neo4jData: Neo4jTeamMemberNodeData): RFTeamMemberNode {
  // Parse arrays from JSON strings
  const roles = neo4jData.roles ? JSON.parse(neo4jData.roles) : [];
  const skills = neo4jData.skills ? JSON.parse(neo4jData.skills) : [];
  
  return {
    id: neo4jData.id,
    // Always use 'teamMember' for consistency
    type: 'teamMember',
    position: { x: neo4jData.positionX, y: neo4jData.positionY },
    data: {
      title: neo4jData.title,
      roles: roles,
      bio: neo4jData.bio,
      timezone: neo4jData.timezone,
      dailyRate: neo4jData.dailyRate,
      hoursPerDay: neo4jData.hoursPerDay,
      daysPerWeek: neo4jData.daysPerWeek,
      weeklyCapacity: neo4jData.weeklyCapacity,
      startDate: neo4jData.startDate,
      skills: skills,
      teamId: neo4jData.teamId,
      allocation: neo4jData.allocation,
      name: neo4jData.name,
      createdAt: neo4jData.createdAt,
      updatedAt: neo4jData.updatedAt,
    } as RFTeamMemberNodeData,
  };
}

/**
 * Transform a ReactFlow edge to a Neo4j edge
 */
export function reactFlowToNeo4jEdge(edge: RFTeamMemberEdge): GraphEdge {
  return {
    id: edge.id || `edge-${crypto.randomUUID()}`,
    from: edge.source,
    to: edge.target,
    type: edge.type?.toUpperCase() || 'TEAM',
    properties: {
      label: edge.data?.label,
      memberSummary: edge.data?.memberSummary ? JSON.stringify(edge.data.memberSummary) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
  };
}

/**
 * Transform a Neo4j edge to a ReactFlow edge
 */
export function neo4jToReactFlowEdge(edge: Neo4jTeamMemberEdge): RFTeamMemberEdge {
  let memberSummary: TeamMemberSummary | undefined;
  
  // Parse the memberSummary if it exists
  if (edge.properties?.memberSummary) {
    try {
      memberSummary = JSON.parse(edge.properties.memberSummary);
    } catch (error) {
      console.error('[TeamMemberTransform] Error parsing memberSummary:', error);
    }
  }
  
  return {
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: edge.type.toLowerCase(),
    data: {
      label: edge.properties?.label,
      edgeType: edge.type.toLowerCase(),
      memberSummary
    }
  };
}

/**
 * Transform function for TeamMember nodes (used by neo4j.provider.ts)
 */
export function transformTeamMemberNode(node: Neo4jNode): GraphNode<RFTeamMemberNodeData> | null {
  if (!node?.properties) return null;

  // Check for both possible node types (camelCase and snake_case)
  const nodeLabel = node.labels[0]?.toLowerCase();
  if (nodeLabel !== 'teammember' && nodeLabel !== 'team_member') return null;

  const { positionX, positionY, id, roles, skills, ...properties } = node.properties;

  // Parse JSON strings back to arrays
  const parsedRoles = roles ? JSON.parse(roles as string) : [];
  const parsedSkills = skills ? JSON.parse(skills as string) : [];

  return {
    id: id as string,
    // Always use 'teamMember' for consistency in the UI
    type: 'teamMember',
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      ...properties,
      roles: parsedRoles,
      skills: parsedSkills,
    } as RFTeamMemberNodeData,
  };
}

/**
 * Transform function for TeamMember edges (used by neo4j.provider.ts)
 */
export function transformTeamMemberEdge(relationship: Neo4jRelationship, sourceId?: string, targetId?: string): GraphEdge | null {
  if (!relationship.properties) return null;

  const { memberSummary, ...otherProperties } = relationship.properties;
  
  // Parse memberSummary if it exists
  let parsedMemberSummary: string | undefined = undefined;
  if (memberSummary) {
    try {
      // Keep it as a string for the GraphEdge properties
      parsedMemberSummary = memberSummary as string;
    } catch (error) {
      console.error('[TeamMemberTransform] Error handling memberSummary:', error);
    }
  }

  return {
    id: relationship.properties.id as string || `edge-${crypto.randomUUID()}`,
    from: sourceId || relationship.start.toString(),
    to: targetId || relationship.end.toString(),
    type: relationship.type,
    properties: {
      ...otherProperties,
      memberSummary: parsedMemberSummary
    },
  };
} 