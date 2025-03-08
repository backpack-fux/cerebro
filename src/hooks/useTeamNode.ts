import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useNodeConnections, useEdges } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFTeamNodeData, 
  Season, 
  RosterMember 
} from '@/services/graph/team/team.types';
import { RFTeamMemberNodeData } from "@/services/graph/team-member/team-member.types";
import { prepareDataForBackend, parseDataFromBackend } from "@/lib/utils";

/**
 * Type guard for team member nodes
 */
function isTeamMemberNode(node: any): node is { id: string, data: RFTeamMemberNodeData } {
  return Boolean(
    node?.type === 'teamMember' && 
    node.data && 
    typeof node.data.title === 'string' && 
    typeof node.data.weeklyCapacity === 'number'
  );
}

/**
 * Hook for managing team node state and operations
 * Separates domain logic from React Flow component state
 */
export function useTeamNode(id: string, data: RFTeamNodeData) {
  const { updateNodeData, setNodes, getNodes, setEdges } = useReactFlow();
  const connections = useNodeConnections({ id });
  const edges = useEdges();
  
  // Define JSON fields that need special handling
  const jsonFields = ['roster', 'seasons'];
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as RFTeamNodeData;
  }, [data, jsonFields]);
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(parsedData.title);
  const [description, setDescription] = useState(parsedData.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const seasonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rosterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Process roster to ensure it's always an array
  const processedRoster = useMemo(() => {
    if (!parsedData.roster) return [];
    
    if (Array.isArray(parsedData.roster)) {
      return parsedData.roster;
    }
    
    return [];
  }, [parsedData.roster]);
  
  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFTeamNodeData>) => {
    try {
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Send to backend
      await GraphApiClient.updateNode('team' as NodeType, id, apiData);
      
      // Update React Flow state with the original object data (not stringified)
      updateNodeData(id, updates);
    } catch (error) {
      console.error(`Failed to update team node:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [id, updateNodeData, jsonFields]);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(parsedData.title);
    setDescription(parsedData.description || '');
  }, [parsedData.title, parsedData.description]);

  // Calculate season progress
  const seasonProgress = useMemo(() => {
    if (!parsedData.season?.startDate || !parsedData.season?.endDate) {
      return {
        progress: 0,
        daysRemaining: 0,
        isActive: false,
        hasStarted: false,
        hasEnded: false
      };
    }

    const start = new Date(parsedData.season.startDate);
    const end = new Date(parsedData.season.endDate);
    const now = new Date();
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
    
    const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      progress,
      daysRemaining,
      isActive: now >= start && now <= end,
      hasStarted: now >= start,
      hasEnded: now > end
    };
  }, [parsedData.season]);

  // Calculate bandwidth
  const bandwidth = useMemo(() => {
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
        return sum + (weeklyCapacity * (member.allocation / 100));
      }
      return sum;
    }, 0);

    // Calculate allocated bandwidth to work nodes
    const allocated = rosterArray.reduce((sum: number, member: RosterMember) => {
      const memberAllocations = member.allocations || [];
      const teamMember = teamMembers.find(tm => tm.id === member.memberId);
      if (!teamMember) return sum;

      const memberTotal = memberAllocations.reduce((memberSum: number, allocation: any) => {
        const weeklyCapacity = Number(teamMember.data.weeklyCapacity);
        return memberSum + (allocation.percentage / 100) * 
          (weeklyCapacity * (member.allocation / 100));
      }, 0);

      return sum + memberTotal;
    }, 0);

    return {
      total,
      allocated,
      available: total - allocated,
      utilizationRate: total > 0 ? (allocated / total) * 100 : 0
    };
  }, [processedRoster, getNodes]);

  // Save roster to backend with debouncing
  const saveRosterToBackend = useCallback(async (roster: RosterMember[]) => {
    if (rosterDebounceRef.current) clearTimeout(rosterDebounceRef.current);
    
    rosterDebounceRef.current = setTimeout(async () => {
      // Ensure each roster member has the required properties
      const validRoster = roster.map(member => ({
        memberId: member.memberId,
        allocation: typeof member.allocation === 'number' ? member.allocation : 80,
        role: member.role || "Developer",
        startDate: member.startDate || new Date().toISOString().split('T')[0],
        allocations: member.allocations || []
      }));
      
      await saveToBackend({ roster: validRoster });
      rosterDebounceRef.current = null;
    }, 1000);
  }, [saveToBackend]);

  // Save season to backend with debouncing
  const saveSeasonToBackend = useCallback(async (season: Season) => {
    if (seasonDebounceRef.current) clearTimeout(seasonDebounceRef.current);
    
    seasonDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ season });
      seasonDebounceRef.current = null;
    }, 1000);
  }, [saveToBackend]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    updateNodeData(id, { ...parsedData, title: newTitle });
    
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ title: newTitle });
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    setDescription(newDescription);
    updateNodeData(id, { ...parsedData, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ description: newDescription });
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Handle season change
  const handleSeasonChange = useCallback((updates: Partial<Season>) => {
    const defaultSeason: Season = {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      name: 'New Season'
    };

    const updatedSeason = { ...(parsedData.season || defaultSeason), ...updates };
    
    updateNodeData(id, {
      ...parsedData,
      season: updatedSeason
    });
    
    saveSeasonToBackend(updatedSeason);
  }, [id, parsedData, updateNodeData, saveSeasonToBackend]);

  // Remove roster member
  const removeRosterMember = useCallback((memberId: string) => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
    const updatedRoster = rosterArray.filter((member: RosterMember) => member.memberId !== memberId);
    
    updateNodeData(id, {
      ...parsedData,
      roster: updatedRoster
    });
    
    // Also delete the edge
    const edge = edges.find(e => 
      (e.source === id && e.target === memberId) || 
      (e.target === id && e.source === memberId)
    );
    
    if (edge) {
      GraphApiClient.deleteEdge('team' as NodeType, edge.id)
        .then(() => {
          setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        })
        .catch((error) => console.error('Failed to delete edge:', error));
    }
    
    saveRosterToBackend(updatedRoster);
  }, [id, parsedData, updateNodeData, edges, setEdges, processedRoster, saveRosterToBackend]);

  // Handle allocation change
  const handleAllocationChange = useCallback((memberId: string, allocation: number) => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
    const updatedRoster = rosterArray.map((member: RosterMember) => {
      if (member.memberId === memberId) {
        return { ...member, allocation };
      }
      return member;
    });
    
    updateNodeData(id, {
      ...parsedData,
      roster: updatedRoster
    });
    
    saveRosterToBackend(updatedRoster);
    
    // Also update the team member node
    const teamMember = getNodes().find(n => n.id === memberId);
    if (teamMember) {
      GraphApiClient.updateNode('teamMember' as NodeType, memberId, { allocation })
        .catch(error => {
          console.error(`Failed to update team member allocation:`, error);
          toast.error("Failed to update allocation", {
            description: "The team member allocation could not be updated."
          });
        });
    }
  }, [id, parsedData, updateNodeData, getNodes, processedRoster, saveRosterToBackend]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    // Delete the node from the backend
    GraphApiClient.deleteNode('team' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete connected edges
        const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
        connectedEdges.forEach((edge) => {
          GraphApiClient.deleteEdge('team' as NodeType, edge.id)
            .catch((error) => console.error('Failed to delete edge:', error));
        });
      })
      .catch((error) => {
        console.error('Failed to delete team node:', error);
        toast.error("Delete Failed: Failed to delete the team node from the server.");
      });
  }, [id, setNodes, edges]);

  // Handle edge disconnection
  const handleDisconnect = useCallback((edgeId: string) => {
    GraphApiClient.deleteEdge('team' as NodeType, edgeId)
      .then(() => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      })
      .catch((error) => console.error('Failed to delete edge:', error));
  }, [setEdges]);

  // Initialize season with defaults if it doesn't exist
  useEffect(() => {
    if (!parsedData.season) {
      const defaultSeason: Season = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        name: 'New Season'
      };
      
      updateNodeData(id, {
        ...parsedData,
        season: defaultSeason
      });
      
      saveSeasonToBackend(defaultSeason);
    }
  }, [id, parsedData, updateNodeData, saveSeasonToBackend]);

  // Watch for member connections
  useEffect(() => {
    const connectedMembers = connections
      .filter(conn => {
        const node = getNodes().find(n => n.id === conn.source);
        return node?.type === 'teamMember';
      })
      .map(conn => {
        const memberNode = getNodes().find(n => n.id === conn.source);
        if (!memberNode) return null;

        // Create a new roster member with default values
        const newMember: RosterMember = {
          memberId: memberNode.id,
          // Get the role from the member node or default to "Developer"
          role: (memberNode.data as any).roles?.[0] || "Developer",
          // Start with a default allocation of 80%
          allocation: 80,
          startDate: new Date().toISOString().split('T')[0],
          allocations: []
        };
        return newMember;
      })
      .filter((member): member is RosterMember => member !== null);

    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
    
    // Add new members to roster
    const currentMemberIds = new Set(rosterArray.map((m: RosterMember) => m.memberId));
    const newMembers = connectedMembers.filter(member => !currentMemberIds.has(member.memberId));

    if (newMembers.length > 0) {
      const updatedRoster = [...rosterArray, ...newMembers];
      updateNodeData(id, {
        ...parsedData,
        roster: updatedRoster
      });
      
      // Save to backend
      saveRosterToBackend(updatedRoster);
    }
  }, [connections, parsedData, id, updateNodeData, getNodes, processedRoster, saveRosterToBackend]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (seasonDebounceRef.current) clearTimeout(seasonDebounceRef.current);
      if (rosterDebounceRef.current) clearTimeout(rosterDebounceRef.current);
    };
  }, []);

  // Get connected edges
  const connectedEdges = useMemo(() => {
    return edges.filter((edge) => edge.source === id || edge.target === id);
  }, [edges, id]);

  // Memoize the entire return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    title,
    description,
    season: parsedData.season,
    seasonProgress,
    bandwidth,
    processedRoster,
    connectedEdges,
    
    // Actions
    handleTitleChange,
    handleDescriptionChange,
    handleSeasonChange,
    removeRosterMember,
    handleAllocationChange,
    handleDelete,
    handleDisconnect,
    
    // Utilities
    getNodes,
    isTeamMemberNode
  }), [
    title,
    description,
    parsedData.season,
    seasonProgress,
    bandwidth,
    processedRoster,
    connectedEdges,
    handleTitleChange,
    handleDescriptionChange,
    handleSeasonChange,
    removeRosterMember,
    handleAllocationChange,
    handleDelete,
    handleDisconnect,
    getNodes
  ]);
} 