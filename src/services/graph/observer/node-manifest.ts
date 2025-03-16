/**
 * Node Data Manifest System
 * 
 * This file defines what data each node type can publish and subscribe to.
 * It provides a structured way to manage node data dependencies and updates.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';

// Import individual node manifests
import { TeamMemberManifest, TeamMemberFields } from '@/services/graph/team-member/team-member.manifest';
import { TeamManifest, TeamFields } from '@/services/graph/team/team.manifest';
import { FeatureManifest, FeatureFields } from '@/services/graph/feature/feature.manifest';
import { OptionManifest, OptionFields } from '@/services/graph/option/option.manifest';
import { ProviderManifest, ProviderFields } from '@/services/graph/provider/provider.manifest';
import { MilestoneManifest, MilestoneFields } from '@/services/graph/milestone/milestone.manifest';
import { MetaManifest, MetaFields } from '@/services/graph/meta/meta.manifest';
import { CommonFields } from '@/services/graph/base-node/base-manifest';

/**
 * Defines a data field that can be published or subscribed to
 */
export interface DataField {
  /** Unique identifier for the field */
  id: string;
  
  /** Human-readable name of the field */
  name: string;
  
  /** Description of what this field represents */
  description: string;
  
  /** Path to the field in the node data object (dot notation) */
  path: string;
  
  /** Whether changes to this field should trigger immediate updates */
  critical?: boolean;
}

/**
 * Defines what data a node type can publish
 */
export interface PublishManifest {
  /** Fields this node type can publish updates for */
  fields: DataField[];
}

/**
 * Defines what data a node type can subscribe to
 */
export interface SubscribeManifest {
  /** Node types this node can subscribe to */
  nodeTypes: NodeType[];
  
  /** Fields this node type is interested in from each node type */
  fields: {
    [nodeType: string]: string[]; // Array of field IDs
  };
}

/**
 * Complete manifest for a node type
 */
export interface NodeManifest {
  /** What this node type can publish */
  publishes: PublishManifest;
  
  /** What this node type can subscribe to */
  subscribes: SubscribeManifest;
}

// Re-export the common fields and individual field definitions for convenience
export { CommonFields, TeamMemberFields, TeamFields, FeatureFields, OptionFields, ProviderFields, MilestoneFields, MetaFields };

// Define the manifest for each node type by combining the individual manifests
export const NodeManifests: Record<string, NodeManifest> = {
  // Team Member manifest
  teamMember: TeamMemberManifest,
  
  // Team manifest
  team: TeamManifest,
  
  // Feature manifest
  feature: FeatureManifest,

  // Option manifest
  option: OptionManifest,

  // Provider manifest
  provider: ProviderManifest,

  // Milestone manifest
  milestone: MilestoneManifest,

  // Meta manifest
  meta: MetaManifest,
};

/**
 * Get the manifest for a specific node type
 */
export function getNodeManifest(nodeType: string): NodeManifest | undefined {
  return NodeManifests[nodeType];
}

/**
 * Check if a node type publishes a specific field
 */
export function doesNodePublish(nodeType: string, fieldId: string): boolean {
  const manifest = getNodeManifest(nodeType);
  if (!manifest) return false;
  
  return manifest.publishes.fields.some(field => field.id === fieldId);
}

/**
 * Check if a node type subscribes to updates from another node type
 */
export function doesNodeSubscribeTo(subscriberType: string, publisherType: string): boolean {
  const manifest = getNodeManifest(subscriberType);
  if (!manifest) return false;
  
  return manifest.subscribes.nodeTypes.includes(publisherType as NodeType);
}

/**
 * Get the fields a node type subscribes to from another node type
 */
export function getSubscribedFields(subscriberType: string, publisherType: string): string[] {
  const manifest = getNodeManifest(subscriberType);
  if (!manifest) return [];
  
  return manifest.subscribes.fields[publisherType] || [];
}

/**
 * Check if a field update should be considered critical (immediate update)
 */
export function isFieldCritical(nodeType: string, fieldId: string): boolean {
  const manifest = getNodeManifest(nodeType);
  if (!manifest) return false;
  
  const field = manifest.publishes.fields.find(f => f.id === fieldId);
  return field?.critical || false;
}

/**
 * Get detailed information about a field from a node type
 */
export function getFieldDetails(nodeType: string, fieldId: string): DataField | undefined {
  const manifest = getNodeManifest(nodeType);
  if (!manifest) return undefined;
  
  return manifest.publishes.fields.find(f => f.id === fieldId);
}

/**
 * Get all node types that subscribe to a specific field from a publisher
 */
export function getSubscribersForField(publisherType: string, fieldId: string): string[] {
  return Object.entries(NodeManifests)
    .filter(([nodeType, manifest]) => {
      // Check if this node type subscribes to the publisher
      if (!manifest.subscribes.nodeTypes.includes(publisherType as NodeType)) {
        return false;
      }
      
      // Check if this node type subscribes to this specific field
      const subscribedFields = manifest.subscribes.fields[publisherType] || [];
      return subscribedFields.includes(fieldId);
    })
    .map(([nodeType]) => nodeType);
}

/**
 * Debug utility to log information about a data update
 */
export function debugNodeUpdate(
  publisherType: string, 
  publisherId: string, 
  affectedFields: string[]
): void {
  console.group(`[NodeManifest] Update from ${publisherType} ${publisherId}`);
  
  console.log('Affected fields:', affectedFields);
  
  // Log critical fields
  const criticalFields = affectedFields.filter(field => isFieldCritical(publisherType, field));
  if (criticalFields.length > 0) {
    console.log('Critical fields:', criticalFields);
  }
  
  // Log potential subscribers
  const potentialSubscribers = new Map<string, string[]>();
  
  affectedFields.forEach(fieldId => {
    const subscribers = getSubscribersForField(publisherType, fieldId);
    subscribers.forEach(subscriberType => {
      if (!potentialSubscribers.has(subscriberType)) {
        potentialSubscribers.set(subscriberType, []);
      }
      potentialSubscribers.get(subscriberType)?.push(fieldId);
    });
  });
  
  if (potentialSubscribers.size > 0) {
    console.log('Potential subscribers:');
    potentialSubscribers.forEach((fields, subscriberType) => {
      console.log(`- ${subscriberType} (interested in: ${fields.join(', ')})`);
    });
  } else {
    console.log('No subscribers for these fields');
  }
  
  console.groupEnd();
} 