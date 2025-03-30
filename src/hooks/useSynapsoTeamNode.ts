import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useNodeConnections, useEdges, Node } from "@xyflow/react";
import { toast } from "sonner";
import { 
  Season, 
  RosterMember
} from '@/services/graph/team/team.types';
import { getCurrentDate } from "@/utils/time/calendar";
import { calculateEffectiveCapacity } from "@/utils/allocation/capacity";
import { useSynapso } from './useSynapso';
import { WorkflowNode } from "@/types/synapso";

// Define team node data structure that matches what Synapso will provide
export interface SynapsoTeamNodeData {
  id: string;
  title: string;
  description?: string;
  roster?: RosterMember[];
  season?: Season;
  type: string;
}

/**
 * Type guard for team member nodes
 */
function isTeamMemberNode(node: unknown): node is Node<{
  title: string;
  weeklyCapacity: number;
  [key: string]: any;
}> {
  if (!node) return false;
  
  const typedNode = node as { id?: string; type?: string; data?: Record<string, unknown> };
  
  return Boolean(
    typedNode.type === 'teamMember' && 
    typedNode.data && 
    typeof typedNode.data.title === 'string' && 
    typeof typedNode.data.weeklyCapacity === 'number'
  );
}

/**
 * Hook for managing team node state and operations
 * Uses Synapso API instead of direct Neo4j access
 */
export function useSynapsoTeamNode(id: string, workflowId: string) {
  const { updateNodeData, setNodes, getNodes, setEdges } = useReactFlow();
  const connections = useNodeConnections({ id });
  const edges = useEdges();
  
  // Use Synapso service for data operations
  const { 
    nodes, 
    updateNode, 
    deleteNode, 
    createEdge, 
    deleteEdge,
    subscribeToEvent 
  } = useSynapso({ workflowId, enableRealtime: true });
  
  // Find the current node data
  const nodeData = useMemo(() => {
    const node = nodes.find(n => n.id === id);
    return node?.data || {} as SynapsoTeamNodeData;
  }, [id, nodes]);
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(nodeData.title || '');
  const [description, setDescription] = useState(nodeData.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const seasonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rosterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Process roster to ensure it's always an array
  const processedRoster = useMemo(() => {
    if (!nodeData.roster) return [];
    
    if (Array.isArray(nodeData.roster)) {
      return nodeData.roster;
    }
    
    return [];
  }, [nodeData.roster]);
  
  // Add a state to force re-renders when roster allocations change
  const [updateCounter, setUpdateCounter] = useState(0);
  // Reference to store the last roster allocations for comparison
  const lastRosterAllocationsRef = useRef('');
  
  // Save to backend function using Synapso client
  const saveToBackend = useCallback(async (updates: Partial<SynapsoTeamNodeData>) => {
    try {
      // Send to Synapso backend
      await updateNode(id, { data: { ...nodeData, ...updates } });
      
      // Update React Flow state
      updateNodeData(id, updates);
    } catch (error) {
      console.error(`Failed to update team node:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, updateNode, updateNodeData, nodeData]);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(nodeData.title || '');
    setDescription(nodeData.description || '');
  }, [nodeData.title, nodeData.description]);

  // Calculate season progress
  const seasonProgress = useMemo(() => {
    // Debug the season data
    const now = getCurrentDate();

    // Validate date inputs to ensure they are proper date strings
    if (!nodeData.season?.startDate || !nodeData.season?.endDate) {
      return {
        progress: 0,
        daysRemaining: 0,
        isActive: false,
        hasStarted: false,
        hasEnded: false,
        isFuture: false
      };
    }

    try {
      // Simple direct comparison of dates
      const start = new Date(nodeData.season.startDate);
      const end = new Date(nodeData.season.endDate);
      
      // Ensure dates are valid
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          progress: 0,
          daysRemaining: 0,
          isActive: false,
          hasStarted: false,
          hasEnded: false,
          isFuture: false
        };
      }
      
      // Simple status determination
      const isBeforeStart = now < start;
      const isAfterEnd = now > end;
      const isActive = !isBeforeStart && !isAfterEnd;
      
      // Calculate progress
      const total = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      let progress = 0;
      
      if (isBeforeStart) {
        progress = 0;
      } else if (isAfterEnd) {
        progress = 100;
      } else {
        progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
      }
      
      // Calculate days remaining
      let daysRemaining = 0;
      if (isBeforeStart) {
        daysRemaining = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (isActive) {
        daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      const result = {
        progress,
        daysRemaining,
        isActive,
        hasStarted: !isBeforeStart,
        hasEnded: isAfterEnd,
        isFuture: isBeforeStart
      };
      
      return result;
    } catch (error) {
      console.error('[TeamNode] Error calculating season progress:', error);
      return {
        progress: 0,
        daysRemaining: 0,
        isActive: false,
        hasStarted: false,
        hasEnded: false,
        isFuture: false
      };
    }
  }, [nodeData.season]);
  
  // Watch for changes in roster allocations from work nodes
  useEffect(() => {
    const interval = setInterval(() => {
      // Get the current roster
      const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
      
      // Create a stringified version of the allocations to detect changes
      const allocationsString = JSON.stringify(rosterArray.map(member => ({
        memberId: member.memberId,
        allocation: member.allocation,
        allocations: member.allocations
      })));
      
      // Compare with the last known state
      if (allocationsString !== lastRosterAllocationsRef.current) {
        lastRosterAllocationsRef.current = allocationsString;
        setUpdateCounter(prev => prev + 1);
        console.log('[TeamNode] Detected changes in roster allocations, updating bandwidth');
      }
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, [processedRoster]);

  // Calculate bandwidth
  const bandwidth = useMemo(() => {
    console.log('[TeamNode] Recalculating bandwidth, update counter:', updateCounter);
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
    
    const teamMembers = getNodes()
      .filter(node => 
        node.type === 'teamMember' && 
        rosterArray.some((member: RosterMember) => member.memberId === node.id)
      )
      .filter(isTeamMemberNode);

    // Calculate total team bandwidth from member allocations
    const total = rosterArray.reduce((sum: number, member: RosterMember) => {
      const teamMember = teamMembers.find(tm => tm.id === member.memberId);
      if (teamMember) {
        const weeklyCapacity = Number(teamMember.data.weeklyCapacity);
        // Use our utility function to calculate effective capacity
        return sum + calculateEffectiveCapacity(weeklyCapacity, member.allocation);
      }
      return sum;
    }, 0);

    // Calculate allocated bandwidth to work nodes
    const allocated = rosterArray.reduce((sum: number, member: RosterMember) => {
      const memberAllocations = member.allocations || [];
      const teamMember = teamMembers.find(tm => tm.id === member.memberId);
      if (!teamMember) return sum;

      const memberTotal = memberAllocations.reduce((memberSum: number, allocation: { nodeId: string; percentage: number }) => {
        const weeklyCapacity = Number(teamMember.data.weeklyCapacity);
        // Calculate the effective capacity for this team member
        const effectiveCapacity = calculateEffectiveCapacity(weeklyCapacity, member.allocation);
        // Calculate the allocation to this specific work node
        return memberSum + (allocation.percentage / 100) * effectiveCapacity;
      }, 0);

      return sum + memberTotal;
    }, 0);

    const available = total - allocated;
    const utilizationRate = total > 0 ? (allocated / total) * 100 : 0;

    return {
      total,
      allocated,
      available,
      utilizationRate,
      totalHours: total
    };
  }, [processedRoster, getNodes, updateCounter]);

  // Calculate connected edges
  const connectedEdges = useMemo(() => {
    return edges.filter(
      edge => edge.source === id || edge.target === id
    );
  }, [edges, id]);

  // Node CRUD operations

  // Handle title change with debounce
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);

    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }

    titleDebounceRef.current = setTimeout(() => {
      saveToBackend({ title: newTitle });
    }, 500);
  }, [saveToBackend]);

  // Handle description change with debounce
  const handleDescriptionChange = useCallback((newDescription: string) => {
    setDescription(newDescription);

    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }

    descriptionDebounceRef.current = setTimeout(() => {
      saveToBackend({ description: newDescription });
    }, 500);
  }, [saveToBackend]);

  // Handle season change with debounce
  const handleSeasonChange = useCallback((seasonUpdate: Partial<Season>) => {
    const currentSeason = nodeData.season || { startDate: '', endDate: '' };
    const updatedSeason = { ...currentSeason, ...seasonUpdate };

    if (seasonDebounceRef.current) {
      clearTimeout(seasonDebounceRef.current);
    }

    seasonDebounceRef.current = setTimeout(() => {
      saveToBackend({ season: updatedSeason });
    }, 500);
  }, [nodeData.season, saveToBackend]);

  // Handle removing a team member from the roster
  const removeRosterMember = useCallback((memberId: string) => {
    // Filter out the member to be removed
    const updatedRoster = processedRoster.filter(
      member => member.memberId !== memberId
    );

    // Save the updated roster
    saveToBackend({ roster: updatedRoster });
  }, [processedRoster, saveToBackend]);

  // Handle changing allocation for a team member
  const handleAllocationChange = useCallback((memberId: string, allocation: number) => {
    // Find and update the member's allocation
    const updatedRoster = processedRoster.map(member => {
      if (member.memberId === memberId) {
        return { ...member, allocation };
      }
      return member;
    });

    if (rosterDebounceRef.current) {
      clearTimeout(rosterDebounceRef.current);
    }

    rosterDebounceRef.current = setTimeout(() => {
      saveToBackend({ roster: updatedRoster });
    }, 300);
  }, [processedRoster, saveToBackend]);

  // Handle node deletion
  const handleDelete = useCallback(async () => {
    try {
      // First delete all connected edges
      await Promise.all(
        connectedEdges.map(edge => deleteEdge(workflowId, edge.id))
      );

      // Then delete the node itself
      await deleteNode(id, workflowId);
      
      // Update local React Flow state
      setNodes(nodes => nodes.filter(node => node.id !== id));
      setEdges(edges => edges.filter(edge => edge.source !== id && edge.target !== id));
      
      toast.success('Team node deleted successfully');
    } catch (error) {
      console.error('Failed to delete team node:', error);
      toast.error(`Delete Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, workflowId, connectedEdges, deleteNode, deleteEdge, setNodes, setEdges]);

  // Handle disconnecting an edge
  const handleDisconnect = useCallback(async (edgeId: string) => {
    try {
      await deleteEdge(workflowId, edgeId);
      
      // Update local React Flow state
      setEdges(edges => edges.filter(edge => edge.id !== edgeId));
      
      toast.success('Connection removed');
    } catch (error) {
      console.error('Failed to disconnect edge:', error);
      toast.error(`Disconnect Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [workflowId, deleteEdge, setEdges]);

  return {
    title,
    description,
    season: nodeData.season,
    seasonProgress,
    processedRoster,
    bandwidth,
    connectedEdges,
    
    // Methods
    handleTitleChange,
    handleDescriptionChange,
    handleSeasonChange,
    removeRosterMember,
    handleAllocationChange, 
    handleDelete,
    handleDisconnect,
    
    // Utils
    getNodes,
    isTeamMemberNode
  };
} 