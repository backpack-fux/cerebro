/**
 * TEMPORARY PLACEHOLDER HOOK
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * Please migrate to useSynapsoProviderNode.ts following the migration guide.
 */

export function useProviderNode() {
  console.warn('useProviderNode is deprecated. Please migrate to useSynapsoProviderNode.');
  
  return {
    title: 'Provider Node (Placeholder)',
    description: 'This is a placeholder. Please migrate to Synapso.',
    handleTitleChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDescriptionChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDelete: () => console.warn('Operation not supported - migrate to Synapso'),
  };
} 