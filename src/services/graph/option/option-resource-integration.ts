/**
 * Option Resource Integration
 * 
 * This file integrates the team resource observer with the option service
 * to ensure consistent resource allocation across all node types.
 */

import { integrateWithOptionNode } from '../observer/team-resource-integration';
import { RFOptionNode, RFOptionNodeData } from './option.types';

// Map to store option-team integrations
const optionTeamIntegrations = new Map<string, Map<string, ReturnType<typeof integrateWithOptionNode>>>();

/**
 * Connect an option node to a team's resources
 * 
 * @param optionNode The option node data
 * @param teamId The ID of the team to connect to
 * @param onUpdate Callback function to handle resource updates
 * @returns Object with methods to manage resource allocation
 */
export function connectOptionToTeam(
  optionNode: RFOptionNode,
  teamId: string,
  onUpdate: (data: Partial<RFOptionNodeData>) => void
) {
  const optionId = optionNode.id;
  
  // Check if this option already has integrations
  if (!optionTeamIntegrations.has(optionId)) {
    optionTeamIntegrations.set(optionId, new Map());
  }
  
  // Check if this option is already connected to this team
  const optionIntegrations = optionTeamIntegrations.get(optionId)!;
  if (optionIntegrations.has(teamId)) {
    // Already connected, return existing integration
    return optionIntegrations.get(teamId)!;
  }
  
  // Create new integration
  const integration = integrateWithOptionNode(
    optionId,
    teamId,
    optionNode.data,
    onUpdate
  );
  
  // Store the integration
  optionIntegrations.set(teamId, integration);
  
  console.log(`[OptionResourceIntegration] Connected option ${optionId} to team ${teamId}`);
  
  return integration;
}

/**
 * Disconnect an option node from a team's resources
 * 
 * @param optionId The ID of the option node
 * @param teamId The ID of the team to disconnect from
 */
export function disconnectOptionFromTeam(optionId: string, teamId: string) {
  // Check if this option has integrations
  if (!optionTeamIntegrations.has(optionId)) {
    return;
  }
  
  // Check if this option is connected to this team
  const optionIntegrations = optionTeamIntegrations.get(optionId)!;
  if (!optionIntegrations.has(teamId)) {
    return;
  }
  
  // Get the integration
  const integration = optionIntegrations.get(teamId)!;
  
  // Clean up the integration
  integration.cleanup();
  
  // Remove the integration
  optionIntegrations.delete(teamId);
  
  // If no more integrations, remove the option
  if (optionIntegrations.size === 0) {
    optionTeamIntegrations.delete(optionId);
  }
  
  console.log(`[OptionResourceIntegration] Disconnected option ${optionId} from team ${teamId}`);
}

/**
 * Update resource allocation for an option node
 * 
 * @param optionId The ID of the option node
 * @param teamId The ID of the team
 * @param memberAllocations Array of member allocations
 * @param projectDurationDays The project duration in days
 * @returns The result of the allocation request
 */
export function updateOptionResourceAllocation(
  optionId: string,
  teamId: string,
  memberAllocations: Array<{
    memberId: string;
    name: string;
    hours: number;
  }>,
  projectDurationDays: number
) {
  // Check if this option has integrations
  if (!optionTeamIntegrations.has(optionId)) {
    console.warn(`[OptionResourceIntegration] Option ${optionId} not connected to any team`);
    return null;
  }
  
  // Check if this option is connected to this team
  const optionIntegrations = optionTeamIntegrations.get(optionId)!;
  if (!optionIntegrations.has(teamId)) {
    console.warn(`[OptionResourceIntegration] Option ${optionId} not connected to team ${teamId}`);
    return null;
  }
  
  // Get the integration
  const integration = optionIntegrations.get(teamId)!;
  
  // Request allocation
  return integration.allocateResources(memberAllocations, projectDurationDays);
}

/**
 * Get available hours for a team member in an option node context
 * 
 * @param optionId The ID of the option node
 * @param teamId The ID of the team
 * @param memberId The ID of the team member
 * @param memberData The team member data containing capacity and availability information
 * @param projectDurationDays The project duration in days
 * @returns The available hours for the member
 */
export function getOptionMemberAvailableHours(
  optionId: string,
  teamId: string,
  memberId: string,
  memberData: {
    weeklyCapacity?: number;
    hoursPerDay?: number;
    daysPerWeek?: number;
    allocation?: number;
    [key: string]: unknown;
  },
  projectDurationDays: number
) {
  // Check if this option has integrations
  if (!optionTeamIntegrations.has(optionId)) {
    console.warn(`[OptionResourceIntegration] Option ${optionId} not connected to any team`);
    return 0;
  }
  
  // Check if this option is connected to this team
  const optionIntegrations = optionTeamIntegrations.get(optionId)!;
  if (!optionIntegrations.has(teamId)) {
    console.warn(`[OptionResourceIntegration] Option ${optionId} not connected to team ${teamId}`);
    return 0;
  }
  
  // Get the integration
  const integration = optionIntegrations.get(teamId)!;
  
  // Get available hours
  return integration.getAvailableHours(memberId, memberData, projectDurationDays);
} 