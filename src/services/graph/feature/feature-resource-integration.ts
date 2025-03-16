/**
 * Feature Resource Integration
 * 
 * This file integrates the team resource observer with the feature service
 * to ensure consistent resource allocation across all node types.
 */

import { integrateWithFeatureNode } from '../observer/team-resource-integration';
import { RFFeatureNode } from './feature.types';

// Map to store feature-team integrations
const featureTeamIntegrations = new Map<string, Map<string, ReturnType<typeof integrateWithFeatureNode>>>();

/**
 * Connect a feature node to a team's resources
 * 
 * @param featureNode The feature node data
 * @param teamId The ID of the team to connect to
 * @param onUpdate Callback function to handle resource updates
 * @returns Object with methods to manage resource allocation
 */
export function connectFeatureToTeam(
  featureNode: RFFeatureNode,
  teamId: string,
  onUpdate: (data: any) => void
) {
  const featureId = featureNode.id;
  
  // Check if this feature already has integrations
  if (!featureTeamIntegrations.has(featureId)) {
    featureTeamIntegrations.set(featureId, new Map());
  }
  
  // Check if this feature is already connected to this team
  const featureIntegrations = featureTeamIntegrations.get(featureId)!;
  if (featureIntegrations.has(teamId)) {
    // Already connected, return existing integration
    return featureIntegrations.get(teamId)!;
  }
  
  // Create new integration
  const integration = integrateWithFeatureNode(
    featureId,
    teamId,
    featureNode.data,
    onUpdate
  );
  
  // Store the integration
  featureIntegrations.set(teamId, integration);
  
  console.log(`[FeatureResourceIntegration] Connected feature ${featureId} to team ${teamId}`);
  
  return integration;
}

/**
 * Disconnect a feature node from a team's resources
 * 
 * @param featureId The ID of the feature node
 * @param teamId The ID of the team to disconnect from
 */
export function disconnectFeatureFromTeam(featureId: string, teamId: string) {
  // Check if this feature has integrations
  if (!featureTeamIntegrations.has(featureId)) {
    return;
  }
  
  // Check if this feature is connected to this team
  const featureIntegrations = featureTeamIntegrations.get(featureId)!;
  if (!featureIntegrations.has(teamId)) {
    return;
  }
  
  // Get the integration
  const integration = featureIntegrations.get(teamId)!;
  
  // Clean up the integration
  integration.cleanup();
  
  // Remove the integration
  featureIntegrations.delete(teamId);
  
  // If no more integrations, remove the feature
  if (featureIntegrations.size === 0) {
    featureTeamIntegrations.delete(featureId);
  }
  
  console.log(`[FeatureResourceIntegration] Disconnected feature ${featureId} from team ${teamId}`);
}

/**
 * Update resource allocation for a feature node
 * 
 * @param featureId The ID of the feature node
 * @param teamId The ID of the team
 * @param memberAllocations Array of member allocations
 * @param projectDurationDays The project duration in days
 * @returns The result of the allocation request
 */
export function updateFeatureResourceAllocation(
  featureId: string,
  teamId: string,
  memberAllocations: Array<{
    memberId: string;
    name: string;
    hours: number;
  }>,
  projectDurationDays: number
) {
  // Check if this feature has integrations
  if (!featureTeamIntegrations.has(featureId)) {
    console.warn(`[FeatureResourceIntegration] Feature ${featureId} not connected to any team`);
    return null;
  }
  
  // Check if this feature is connected to this team
  const featureIntegrations = featureTeamIntegrations.get(featureId)!;
  if (!featureIntegrations.has(teamId)) {
    console.warn(`[FeatureResourceIntegration] Feature ${featureId} not connected to team ${teamId}`);
    return null;
  }
  
  // Get the integration
  const integration = featureIntegrations.get(teamId)!;
  
  // Request allocation
  return integration.allocateResources(memberAllocations, projectDurationDays);
}

/**
 * Get available hours for a team member in a feature node context
 * 
 * @param featureId The ID of the feature node
 * @param teamId The ID of the team
 * @param memberId The ID of the team member
 * @param memberData The team member data
 * @param projectDurationDays The project duration in days
 * @returns The available hours for the member
 */
export function getFeatureMemberAvailableHours(
  featureId: string,
  teamId: string,
  memberId: string,
  memberData: any,
  projectDurationDays: number
) {
  // Check if this feature has integrations
  if (!featureTeamIntegrations.has(featureId)) {
    console.warn(`[FeatureResourceIntegration] Feature ${featureId} not connected to any team`);
    return 0;
  }
  
  // Check if this feature is connected to this team
  const featureIntegrations = featureTeamIntegrations.get(featureId)!;
  if (!featureIntegrations.has(teamId)) {
    console.warn(`[FeatureResourceIntegration] Feature ${featureId} not connected to team ${teamId}`);
    return 0;
  }
  
  // Get the integration
  const integration = featureIntegrations.get(teamId)!;
  
  // Get available hours
  return integration.getAvailableHours(memberId, memberData, projectDurationDays);
} 