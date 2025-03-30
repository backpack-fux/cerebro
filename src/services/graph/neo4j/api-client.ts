/**
 * TEMPORARY PLACEHOLDER
 * 
 * This file serves as a temporary placeholder to prevent import errors.
 * This code is deprecated and will be removed. Please migrate to Synapso API.
 */

// Placeholder GraphApiClient with no-op methods
export const GraphApiClient = {
  getNodes: async () => {
    console.warn('GraphApiClient.getNodes is deprecated. Please migrate to Synapso API.');
    return [];
  },
  getNode: async () => {
    console.warn('GraphApiClient.getNode is deprecated. Please migrate to Synapso API.');
    return null;
  },
  createNode: async () => {
    console.warn('GraphApiClient.createNode is deprecated. Please migrate to Synapso API.');
    return { id: 'placeholder' };
  },
  updateNode: async () => {
    console.warn('GraphApiClient.updateNode is deprecated. Please migrate to Synapso API.');
    return { id: 'placeholder' };
  },
  deleteNode: async () => {
    console.warn('GraphApiClient.deleteNode is deprecated. Please migrate to Synapso API.');
    return true;
  },
  getEdges: async () => {
    console.warn('GraphApiClient.getEdges is deprecated. Please migrate to Synapso API.');
    return [];
  },
  createEdge: async () => {
    console.warn('GraphApiClient.createEdge is deprecated. Please migrate to Synapso API.');
    return { id: 'placeholder' };
  },
  deleteEdge: async () => {
    console.warn('GraphApiClient.deleteEdge is deprecated. Please migrate to Synapso API.');
    return true;
  }
}; 