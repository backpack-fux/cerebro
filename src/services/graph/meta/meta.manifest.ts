/**
 * Meta Node Manifest
 * 
 * This file defines what data the meta node type can publish and subscribe to.
 */

import { NodeType } from '@/services/graph/neo4j/api-urls';
import { DataField } from '@/services/graph/observer/node-manifest';
import { CommonFields, createArrayItemField } from '@/services/graph/base-node/base-manifest';

// Meta specific fields
export const MetaFields: Record<string, DataField> = {
  // Meta nodes are simpler and primarily use common fields
  // Additional fields can be added here as the meta node type evolves
  KNOWLEDGE_TYPE: {
    id: 'knowledgeType',
    name: 'Knowledge Type',
    description: 'The type of knowledge this meta node represents',
    path: 'knowledgeType'
  },
  ROADMAP_PHASE: {
    id: 'roadmapPhase',
    name: 'Roadmap Phase',
    description: 'The phase in the roadmap this meta node represents',
    path: 'roadmapPhase'
  },
  TAGS: {
    id: 'tags',
    name: 'Tags',
    description: 'Tags associated with this meta node',
    path: 'tags'
  },
  PRIORITY: {
    id: 'priority',
    name: 'Priority',
    description: 'The priority level of this meta node',
    path: 'priority',
    critical: true
  },
  RELATED_LINKS: {
    id: 'relatedLinks',
    name: 'Related Links',
    description: 'External links related to this meta node',
    path: 'relatedLinks'
  },
  // Nested fields for tags
  TAG_NAME: createArrayItemField('tags', 'name', 'Tag Name', 'The name of a tag'),
  TAG_COLOR: createArrayItemField('tags', 'color', 'Tag Color', 'The color code for a tag'),
  // Nested fields for related links
  LINK_URL: createArrayItemField('relatedLinks', 'url', 'Link URL', 'The URL of a related link'),
  LINK_TITLE: createArrayItemField('relatedLinks', 'title', 'Link Title', 'The title of a related link'),
  LINK_DESCRIPTION: createArrayItemField('relatedLinks', 'description', 'Link Description', 'The description of a related link')
};

// Define what the meta node publishes
export const MetaPublishes = {
  fields: [
    CommonFields.TITLE,
    CommonFields.DESCRIPTION,
    CommonFields.POSITION,
    CommonFields.CREATED_AT,
    CommonFields.UPDATED_AT,
    MetaFields.KNOWLEDGE_TYPE,
    MetaFields.ROADMAP_PHASE,
    MetaFields.TAGS,
    MetaFields.PRIORITY,
    MetaFields.RELATED_LINKS,
    MetaFields.TAG_NAME,
    MetaFields.TAG_COLOR,
    MetaFields.LINK_URL,
    MetaFields.LINK_TITLE,
    MetaFields.LINK_DESCRIPTION
  ]
};

// Define what the meta node subscribes to
export const MetaSubscribes = {
  nodeTypes: ['milestone', 'feature', 'option', 'provider', 'team', 'teamMember'] as NodeType[],
  fields: {
    milestone: ['title', 'description', 'status', 'kpis'],
    feature: ['title', 'description', 'buildType'],
    option: ['title', 'description', 'optionType'],
    provider: ['title', 'description'],
    team: ['title', 'description'],
    teamMember: ['title', 'description']
  }
};

// Export the complete manifest
export const MetaManifest = {
  publishes: MetaPublishes,
  subscribes: MetaSubscribes
}; 