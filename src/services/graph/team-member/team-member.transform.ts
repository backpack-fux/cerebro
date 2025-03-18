import { RFTeamMemberEdge, Neo4jTeamMemberEdge, TeamMemberSummary, RFTeamMemberNode, RFTeamMemberNodeData, Neo4jTeamMemberNodeData } from './team-member.types';
import { GraphEdge, GraphNode } from '../neo4j/graph.interface';
import { Node as Neo4jNode, Relationship as Neo4jRelationship } from 'neo4j-driver';
import { Role } from '@/services/graph/shared/shared.types';

/**
 * Transform a ReactFlow node to a Neo4j node
 */
export function reactFlowToNeo4j(teamMemberNode: RFTeamMemberNode): Neo4jTeamMemberNodeData {
  const data = teamMemberNode.data as RFTeamMemberNodeData;
  
  // Handle roles - convert to JSON string if it's an array
  let rolesValue = undefined;
  if (data.roles) {
    if (typeof data.roles === 'string') {
      // If it's already a string, check if it's valid JSON
      try {
        JSON.parse(data.roles);
        rolesValue = data.roles;
      } catch {
        rolesValue = JSON.stringify([]);
      }
    } else if (Array.isArray(data.roles)) {
      rolesValue = JSON.stringify(data.roles);
    } else {
      rolesValue = JSON.stringify([]);
    }
  } else {
    rolesValue = JSON.stringify([]);
  }
  
  // Handle skills - convert to JSON string if it's an array
  let skillsValue = undefined;
  if (data.skills) {
    if (typeof data.skills === 'string') {
      // If it's already a string, check if it's valid JSON
      try {
        JSON.parse(data.skills);
        skillsValue = data.skills;
      } catch {
        skillsValue = JSON.stringify([]);
      }
    } else if (Array.isArray(data.skills)) {
      skillsValue = JSON.stringify(data.skills);
    } else {
      skillsValue = JSON.stringify([]);
    }
  } else {
    skillsValue = JSON.stringify([]);
  }
  
  return {
    id: teamMemberNode.id,
    name: data.title || 'Untitled Team Member',
    title: data.title,
    roles: rolesValue,
    bio: data.bio,
    timezone: data.timezone,
    dailyRate: data.dailyRate,
    hoursPerDay: data.hoursPerDay,
    daysPerWeek: data.daysPerWeek,
    weeklyCapacity: data.weeklyCapacity,
    startDate: data.startDate,
    skills: skillsValue,
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
      allocation: edge.data?.allocation,
      role: edge.data?.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
  };
}

/**
 * Transform a Neo4j edge to a ReactFlow edge
 */
export function neo4jToReactFlowEdge(neo4jEdge: Neo4jTeamMemberEdge): RFTeamMemberEdge {
  console.log('[Transform] Converting Neo4j team member edge to React Flow edge:', {
    id: neo4jEdge.id,
    from: neo4jEdge.from,
    to: neo4jEdge.to,
    type: neo4jEdge.type,
    properties: neo4jEdge.properties
  });
  
  let memberSummary: TeamMemberSummary | undefined;
   
  // Parse the memberSummary if it exists
  if (neo4jEdge.properties?.memberSummary) {
    try {
      memberSummary = typeof neo4jEdge.properties.memberSummary === 'string' 
        ? JSON.parse(neo4jEdge.properties.memberSummary) 
        : neo4jEdge.properties.memberSummary;
    } catch (error) {
      console.error('[TeamMemberTransform] Error parsing memberSummary:', error);
    }
  }
  
  return {
    id: neo4jEdge.id,
    source: neo4jEdge.from,
    target: neo4jEdge.to,
    type: 'default', // Always use default type for rendering in React Flow
    data: {
      label: neo4jEdge.properties?.label,
      edgeType: neo4jEdge.type.toLowerCase(), // Store original edge type in data
      memberSummary,
      allocation: neo4jEdge.properties?.allocation,
      role: neo4jEdge.properties?.role
    },
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

  // Parse JSON strings back to arrays with error handling
  let parsedRoles: Role[] = [];
  if (roles) {
    try {
      if (typeof roles === 'string') {
        parsedRoles = JSON.parse(roles);
      } else if (Array.isArray(roles)) {
        parsedRoles = roles;
      }
    } catch (error) {
      console.error('[TeamMemberTransform] Error parsing roles:', error);
      parsedRoles = [];
    }
  }

  let parsedSkills: string[] = [];
  if (skills) {
    try {
      if (typeof skills === 'string') {
        parsedSkills = JSON.parse(skills);
      } else if (Array.isArray(skills)) {
        parsedSkills = skills;
      }
    } catch (error) {
      console.error('[TeamMemberTransform] Error parsing skills:', error);
      parsedSkills = [];
    }
  }

  return {
    id: id as string,
    // Always use 'teamMember' for consistency in the UI
    type: 'teamMember',
    position: {
      x: typeof positionX === 'number' ? positionX : 0,
      y: typeof positionY === 'number' ? positionY : 0,
    },
    data: {
      // Using a type assertion here for Neo4j properties that will be included in node data
      // This is safe since we're handling the JSON fields like roles and skills separately
      ...(properties as Record<string, unknown>),
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