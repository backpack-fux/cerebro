/**
 * TEMPORARY PLACEHOLDER HOOK
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * Please migrate to Synapso events following the migration guide.
 */

export function useNodeObserver() {
  console.warn('useNodeObserver is deprecated. Please migrate to Synapso events.');
  
  return {
    publishUpdate: () => console.warn('Operation not supported - migrate to Synapso events'),
    publishManifestUpdate: () => console.warn('Operation not supported - migrate to Synapso events'),
    subscribeBasedOnManifest: () => console.warn('Operation not supported - migrate to Synapso events'),
  };
} 