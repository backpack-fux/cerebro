/**
 * TEMPORARY PLACEHOLDER HOOK
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * Please migrate to useSynapsoOptionNode.ts following the migration guide.
 */

export function useOptionNode() {
  console.warn('useOptionNode is deprecated. Please migrate to useSynapsoOptionNode.');
  
  return {
    title: 'Option Node (Placeholder)',
    description: 'This is a placeholder. Please migrate to Synapso.',
    handleTitleChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDescriptionChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDelete: () => console.warn('Operation not supported - migrate to Synapso'),
  };
} 