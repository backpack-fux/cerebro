import { Node } from '@xyflow/react';

/**
 * Format member name for display, handling various data sources
 * @param memberId The unique ID of the team member
 * @param nodes Array of all nodes in the graph
 * @param memberData Optional direct member data
 * @returns Formatted member name string
 */
export function formatMemberName(
  memberId: string, 
  nodes?: Node[] | null, 
  memberData?: any
): string {
  // Try to get the name from the member data first
  if (memberData?.name) return memberData.name;
  
  // Check if we have valid nodes array
  if (!nodes || !Array.isArray(nodes)) {
    // If no nodes available, just return the first part of the ID
    return memberId.split('-')[0];
  }
  
  // Otherwise, try to find the node in the graph
  const memberNode = nodes.find(n => n.id === memberId);
  
  // If we found the node, use its title
  if (memberNode?.data?.title) {
    return String(memberNode.data.title);
  }
  
  // Last resort: use the first part of the ID
  return memberId.split('-')[0];
}

/**
 * Get team members from a roster in team node
 * @param teamId The team ID to look up
 * @param nodes Array of all nodes in the graph
 * @returns Array of team members
 */
export function getTeamMembers(teamId: string, nodes: Node[]): Array<{
  memberId: string;
  name: string;
  allocation?: number;
}> {
  // Find the team node
  const teamNode = nodes.find(n => n.id === teamId && n.type === 'team');
  if (!teamNode || !teamNode.data?.roster) return [];
  
  // Get the roster
  let roster: any[] = [];
  if (typeof teamNode.data.roster === 'string') {
    try {
      roster = JSON.parse(teamNode.data.roster);
    } catch (e) {
      console.error('Failed to parse team roster:', e);
      return [];
    }
  } else if (Array.isArray(teamNode.data.roster)) {
    roster = teamNode.data.roster;
  } else {
    return [];
  }
  
  // Format and return team members
  return roster.map((member: any) => {
    const memberNode = nodes.find(n => n.id === member.memberId);
    const name = memberNode?.data?.title || member.name || member.memberId.split('-')[0];
    
    return {
      memberId: member.memberId,
      name,
      allocation: member.allocation
    };
  });
}

/**
 * Type guard for member nodes
 * @param node The node to check
 * @returns True if the node is a member node
 */
export function isMemberNode(node: any): boolean {
  return node?.type === 'member';
} 