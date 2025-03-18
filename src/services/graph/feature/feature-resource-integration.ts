/**
 * Feature Resource Integration
 * 
 * This file integrates the team resource observer with the feature service
 * to ensure consistent resource allocation across all node types.
 */

import { integrateWithFeatureNode } from '../observer/team-resource-integration';
import { RFFeatureNode } from './feature.types';

/**
 * Custom error class for feature integration errors
 */
export class FeatureIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureIntegrationError';
  }
}

// Define the type of data expected by the integrateWithFeatureNode callback
interface ObserverResourceUpdateData {
  teamId: string;
  totalBandwidth?: number;
  availableBandwidth?: number;
  memberResources?: unknown;
  [key: string]: unknown;
}

/**
 * Resource update data interface
 */
export interface ResourceUpdateData {
  teamId: string;
  teamBandwidth?: number;
  availableBandwidth?: number;
  memberAllocations?: Array<{
    memberId: string;
    name?: string;
    availableHours?: number;
    allocatedHours?: number;
  }>;
  memberResources?: Array<{
    memberId: string;
    name?: string;
    availableHours?: number;
    hoursPerDay?: number;
    daysPerWeek?: number;
    weeklyCapacity?: number;
    allocation?: number;
  }>;
  [key: string]: unknown;
}

/**
 * Team member data required for capacity calculations
 */
export interface TeamMemberData {
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyCapacity?: number;
  allocation?: number;
}

/**
 * Interface for the integration object returned by integrateWithFeatureNode
 */
export interface FeatureTeamIntegration {
  /**
   * Allocate resources to team members
   * @param memberAllocations Array of member allocations with hours
   * @param projectDurationDays Project duration in days
   * @returns Result of allocation request
   */
  allocateResources: (
    memberAllocations: Array<{
      memberId: string;
      name: string;
      hours: number;
    }>,
    projectDurationDays: number
  ) => unknown;
  
  /**
   * Release allocated resources
   */
  releaseResources: () => void;
  
  /**
   * Get available hours for a team member
   * @param memberId The team member ID
   * @param memberData The team member data
   * @param projectDurationDays Project duration in days 
   * @returns Available hours for the member
   */
  getAvailableHours: (
    memberId: string,
    memberData: TeamMemberData,
    projectDurationDays: number
  ) => number;
  
  /**
   * Clean up the integration
   */
  cleanup: () => void;
}

// Map to store feature-team integrations
const featureTeamIntegrations = new Map<string, Map<string, FeatureTeamIntegration>>();

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
  onUpdate: (data: ResourceUpdateData) => void
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
  
  // Create a wrapper function to adapt between the different data formats
  const observerUpdateCallback = (data: ObserverResourceUpdateData) => {
    // Transform data from observer format to feature format
    const featureData: ResourceUpdateData = {
      teamId: data.teamId,
      teamBandwidth: data.totalBandwidth,
      availableBandwidth: data.availableBandwidth
    };
    
    // Only include memberResources if present
    if (data.memberResources) {
      // Type assertion to match expected structure
      featureData.memberResources = data.memberResources as ResourceUpdateData['memberResources'];
    }
    
    // Call the original update function
    onUpdate(featureData);
  };
  
  // Create new integration
  const integration = integrateWithFeatureNode(
    featureId,
    teamId,
    featureNode.data,
    observerUpdateCallback
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
 * @throws {FeatureIntegrationError} If feature is not connected to the team
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
    const error = new FeatureIntegrationError(`Feature ${featureId} not connected to any team`);
    console.warn(error.message);
    return null;
  }
  
  // Check if this feature is connected to this team
  const featureIntegrations = featureTeamIntegrations.get(featureId)!;
  if (!featureIntegrations.has(teamId)) {
    const error = new FeatureIntegrationError(`Feature ${featureId} not connected to team ${teamId}`);
    console.warn(error.message);
    return null;
  }
  
  // Get the integration
  const integration = featureIntegrations.get(teamId)!;
  
  // Request allocation
  return integration.allocateResources(memberAllocations, projectDurationDays);
}

/**
 * Get available hours for a team member on a feature
 * 
 * @param featureId The feature ID
 * @param teamId The team ID
 * @param memberId The team member ID
 * @param memberData The team member data
 * @param projectDurationDays The project duration in days
 * @returns Available hours for the member
 * @throws {FeatureIntegrationError} If feature is not connected to the team
 */
export function getFeatureMemberAvailableHours(
  featureId: string,
  teamId: string,
  memberId: string,
  memberData: TeamMemberData,
  projectDurationDays: number
) {
  // Check if this feature has integrations
  if (!featureTeamIntegrations.has(featureId)) {
    const error = new FeatureIntegrationError(`Feature ${featureId} not connected to any team`);
    console.warn(error.message);
    return 0;
  }
  
  // Check if this feature is connected to this team
  const featureIntegrations = featureTeamIntegrations.get(featureId)!;
  if (!featureIntegrations.has(teamId)) {
    const error = new FeatureIntegrationError(`Feature ${featureId} not connected to team ${teamId}`);
    console.warn(error.message);
    return 0;
  }
  
  // Get the integration
  const integration = featureIntegrations.get(teamId)!;
  
  // Get available hours
  return integration.getAvailableHours(memberId, memberData, projectDurationDays);
} 