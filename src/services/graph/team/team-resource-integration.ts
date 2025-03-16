/**
 * Team Resource Integration for Team Service
 * 
 * This file integrates the team resource observer with the team service
 * to ensure team resources are properly initialized and managed.
 */

import { teamResourceObserver } from '../observer/team-resource-observer';
import { nodeObserver, NodeUpdateType } from '../observer/node-observer';
import { RFTeamNode } from './team.types';

/**
 * Initialize team resources when a team is created or updated
 * 
 * @param teamNode The team node data
 */
export function initializeTeamResources(teamNode: RFTeamNode): void {
  const teamId = teamNode.id;
  const teamData = teamNode.data;
  
  // Initialize team resources in the observer
  teamResourceObserver.initializeTeamResources(teamId, teamData);
  
  console.log(`[TeamResourceIntegration] Initialized resources for team ${teamId}`);
}

/**
 * Set up team node to publish resource updates when its data changes
 * 
 * @param teamId The ID of the team node
 */
export function setupTeamResourcePublishing(teamId: string): void {
  // Set up a publisher for the team node
  // This will ensure that when the team data changes, it publishes updates
  // to all work nodes that are subscribed to it
  
  // Subscribe to the team's own updates to republish them as resource updates
  const unsubscribe = nodeObserver.subscribe(
    'team-resource-integration',
    teamId,
    (publisherId, data, metadata) => {
      if (metadata.updateType === NodeUpdateType.CONTENT) {
        // When team content changes, reinitialize resources
        teamResourceObserver.initializeTeamResources(teamId, data);
        
        console.log(`[TeamResourceIntegration] Republished resource update for team ${teamId}`);
      }
    },
    NodeUpdateType.CONTENT
  );
  
  // Store the unsubscribe function somewhere if needed for cleanup
  // For now, we'll just let it run for the lifetime of the application
}

/**
 * Update team resources when team roster changes
 * 
 * @param teamId The ID of the team
 * @param roster The updated team roster
 */
export function updateTeamRoster(teamId: string, roster: any[]): void {
  // Create a team data object with the updated roster
  const teamData = {
    roster: roster
  };
  
  // Update team resources
  teamResourceObserver.initializeTeamResources(teamId, teamData);
  
  console.log(`[TeamResourceIntegration] Updated resources for team ${teamId} with new roster`);
} 