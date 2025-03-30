import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { useSynapso } from './useSynapso';

// Define team member node data structure
export interface SynapsoTeamMemberNodeData {
  id: string;
  title: string;
  description?: string;
  role?: string;
  weeklyCapacity?: number;
  type: string;
}

/**
 * Hook for managing team member node state and operations
 * Uses Synapso API instead of direct Neo4j access
 */
export function useSynapsoTeamMemberNode(id: string, workflowId: string) {
  const { updateNodeData } = useReactFlow();
  
  // Use Synapso service for data operations
  const { 
    nodes, 
    updateNode, 
    deleteNode,
    isOffline
  } = useSynapso({ workflowId, enableRealtime: true });
  
  // Find the current node data
  const nodeData = useMemo(() => {
    const node = nodes.find(n => n.id === id);
    return node?.data || {} as SynapsoTeamMemberNodeData;
  }, [id, nodes]);
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(nodeData.title || '');
  const [description, setDescription] = useState(nodeData.description || '');
  const [role, setRole] = useState(nodeData.role || '');
  const [weeklyCapacity, setWeeklyCapacity] = useState(nodeData.weeklyCapacity || 40);
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const roleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const capacityDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Save to backend function using Synapso client
  const saveToBackend = useCallback(async (updates: Partial<SynapsoTeamMemberNodeData>) => {
    try {
      // Send to Synapso backend
      await updateNode(id, { data: { ...nodeData, ...updates } });
      
      // Update React Flow state
      updateNodeData(id, updates);
    } catch (error) {
      console.error(`Failed to update team member node:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, updateNode, updateNodeData, nodeData]);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(nodeData.title || '');
    setDescription(nodeData.description || '');
    setRole(nodeData.role || '');
    setWeeklyCapacity(nodeData.weeklyCapacity || 40);
  }, [nodeData.title, nodeData.description, nodeData.role, nodeData.weeklyCapacity]);
  
  // Handle title change with debounce
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    titleDebounceRef.current = setTimeout(() => {
      saveToBackend({ title: newTitle });
    }, 300);
  }, [saveToBackend]);
  
  // Handle description change with debounce
  const handleDescriptionChange = useCallback((newDescription: string) => {
    setDescription(newDescription);
    
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }
    
    descriptionDebounceRef.current = setTimeout(() => {
      saveToBackend({ description: newDescription });
    }, 300);
  }, [saveToBackend]);
  
  // Handle role change with debounce
  const handleRoleChange = useCallback((newRole: string) => {
    setRole(newRole);
    
    if (roleDebounceRef.current) {
      clearTimeout(roleDebounceRef.current);
    }
    
    roleDebounceRef.current = setTimeout(() => {
      saveToBackend({ role: newRole });
    }, 300);
  }, [saveToBackend]);
  
  // Handle weekly capacity change with debounce
  const handleWeeklyCapacityChange = useCallback((newCapacity: number) => {
    setWeeklyCapacity(newCapacity);
    
    if (capacityDebounceRef.current) {
      clearTimeout(capacityDebounceRef.current);
    }
    
    capacityDebounceRef.current = setTimeout(() => {
      saveToBackend({ weeklyCapacity: newCapacity });
    }, 300);
  }, [saveToBackend]);
  
  // Handle node deletion
  const handleDelete = useCallback(async () => {
    try {
      await deleteNode(id, workflowId);
      toast.success('Team member node deleted successfully');
    } catch (error) {
      console.error('Failed to delete team member node:', error);
      toast.error(`Delete Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, workflowId, deleteNode]);
  
  return {
    title,
    description,
    role,
    weeklyCapacity,
    isOffline,
    
    // Methods
    handleTitleChange,
    handleDescriptionChange,
    handleRoleChange,
    handleWeeklyCapacityChange,
    handleDelete
  };
} 