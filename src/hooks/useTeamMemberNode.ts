/**
 * TEMPORARY PLACEHOLDER HOOK
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * Please migrate to useSynapsoTeamMemberNode.ts following the migration guide.
 */

export function useTeamMemberNode() {
  console.warn('useTeamMemberNode is deprecated. Please migrate to useSynapsoTeamMemberNode.');
  
  return {
    title: 'Team Member Node (Placeholder)',
    description: 'This is a placeholder. Please migrate to Synapso.',
    handleTitleChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDescriptionChange: () => console.warn('Operation not supported - migrate to Synapso'),
    handleDelete: () => console.warn('Operation not supported - migrate to Synapso'),
  };
} 