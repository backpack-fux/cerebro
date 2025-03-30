/**
 * TEMPORARY PLACEHOLDER HOOK
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * Please migrate to useSynapsoMetaNode.ts following the migration guide.
 */

export function useMetaNode() {
  console.warn('useMetaNode is deprecated. Please migrate to useSynapsoMetaNode.');
  
  return {
    title: 'Meta Node (Placeholder)',
    description: 'This is a placeholder. Please migrate to Synapso.',
    handleTitleChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDescriptionChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDelete: () => console.warn('Operation not supported - migrate to Synapso'),
  };
} 