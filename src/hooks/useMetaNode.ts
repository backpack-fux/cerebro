import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useEdges } from "@xyflow/react";
import { toast } from "sonner";
import { RFMetaNode, RFMetaNodeData } from '@/services/graph/meta/meta.types';
import { API_URLS } from '@/services/graph/neo4j/api-urls';

/**
 * Hook for managing meta node state and operations
 * Separates domain logic from React Flow component state
 */
export function useMetaNode(id: string, data: RFMetaNodeData) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(data.title || '');
  const [description, setDescription] = useState(data.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(data.title || '');
    setDescription(data.description || '');
  }, [data.title, data.description]);
  
  // Helper function to save data to backend
  const saveToBackend = useCallback(async (updatedData: Partial<RFMetaNodeData>) => {
    try {
      const response = await fetch(`${API_URLS['meta']}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update meta node: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Updated meta node ${id}:`, updatedData);
    } catch (error) {
      console.error(`Failed to update meta node ${id}:`, error);
      toast.error(`Failed to save changes`, {
        description: `${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }, [id]);

  const handleTitleChange = useCallback((newTitle: string) => {
    // Update local state immediately for responsive UI
    setTitle(newTitle);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, title: newTitle });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newTitle !== data.title) {
          // Persist the change to the database
          await saveToBackend({ title: newTitle });
          console.log(`Updated meta node ${id} title to "${newTitle}"`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update meta node ${id}:`, error);
      }
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);

  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Update local state immediately for responsive UI
    setDescription(newDescription);
    // Update ReactFlow state for consistency
    updateNodeData(id, { ...data, description: newDescription });
    
    // Clear any existing debounce timer
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }
    
    // Set a new debounce timer
    descriptionDebounceRef.current = setTimeout(async () => {
      try {
        // Only make API call if value has changed
        if (newDescription !== data.description) {
          // Persist the change to the database
          await saveToBackend({ description: newDescription });
          console.log(`Updated meta node ${id} description`);
        }
      } catch (error: unknown) {
        console.error(`Failed to update meta node ${id} description:`, error);
      }
      descriptionDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend]);
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    };
  }, []);

  const handleDelete = useCallback(() => {
    // First delete the node from the database
    fetch(`${API_URLS['meta']}/${id}`, { method: 'DELETE' })
      .then(() => {
        console.log(`Successfully deleted meta node ${id}`);
        // Then remove it from the UI
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete associated edges
        const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
        connectedEdges.forEach((edge) => {
          fetch(`${API_URLS['meta']}/edges/${edge.id}`, { method: 'DELETE' })
            .catch((error: unknown) => console.error(`Failed to delete edge ${edge.id}:`, error));
        });
      })
      .catch((error: unknown) => {
        console.error(`Failed to delete meta node ${id}:`, error);
        toast.error(`Failed to delete meta node`, {
          description: `${error instanceof Error ? error.message : 'Unknown error'}`
        });
      });
  }, [id, setNodes, edges]);

  const handleDisconnect = useCallback((edgeId: string) => {
    fetch(`${API_URLS['meta']}/edges/${edgeId}`, { method: 'DELETE' })
      .then(() => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        toast.success('Edge disconnected successfully');
      })
      .catch((error) => {
        console.error('Failed to delete edge:', error);
        toast.error(`Failed to disconnect edge`, {
          description: `${error instanceof Error ? error.message : 'Unknown error'}`
        });
      });
  }, [setEdges]);

  // Get connected edges
  const connectedEdges = useMemo(() => {
    return edges.filter((edge) => edge.source === id || edge.target === id);
  }, [id, edges]);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    title,
    description,
    connectedEdges,
    
    // Actions
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    handleDisconnect
  }), [
    title,
    description,
    connectedEdges,
    handleTitleChange,
    handleDescriptionChange,
    handleDelete,
    handleDisconnect
  ]);
} 