import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useNodeConnections, useEdges, Node } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFTeamNodeData, 
  Season, 
  RosterMember 
} from '@/services/graph/team/team.types';
import { RFTeamMemberNodeData } from "@/services/graph/team-member/team-member.types";
import { prepareDataForBackend, parseDataFromBackend } from "@/utils/utils";
import { getCurrentDate } from "@/utils/time/calendar";
import { calculateEffectiveCapacity } from "@/utils/allocation/capacity";
import { useNodeObserver } from '@/hooks/useNodeObserver';
import { NodeUpdateType } from '@/services/graph/observer/node-observer';

/**
 * Type guard for team member nodes
 */
function isTeamMemberNode(node: unknown): node is Node<RFTeamMemberNodeData> {
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
 * Separates domain logic from React Flow component state
 */
export function useTeamNode(id: string, data: RFTeamNodeData) {
  const { updateNodeData, setNodes, getNodes, setEdges } = useReactFlow();
  const connections = useNodeConnections({ id });
  const edges = useEdges();
  
  // Add the node observer hook
  const { publishUpdate, publishManifestUpdate, subscribeBasedOnManifest } = useNodeObserver<RFTeamNodeData>(id, 'team');
  
  // Define JSON fields that need special handling with useMemo to prevent recreation
  const jsonFields = useMemo(() => ['roster', 'seasons', 'season'], []);
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    const result = parseDataFromBackend(data, jsonFields) as RFTeamNodeData;
    return result;
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
  
  // Add a state to force re-renders when roster allocations change
  const [updateCounter, setUpdateCounter] = useState(0);
  // Reference to store the last roster allocations for comparison
  const lastRosterAllocationsRef = useRef('');
  
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
    // Debug the season data
    const now = getCurrentDate();

    // Validate date inputs to ensure they are proper date strings
    if (!parsedData.season?.startDate || !parsedData.season?.endDate) {
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
      const start = new Date(parsedData.season.startDate);
      const end = new Date(parsedData.season.endDate);
      
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
  }, [parsedData.season]);
  
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

    return {
      total,
      allocated,
      available: total - allocated,
      utilizationRate: total > 0 ? (allocated / total) * 100 : 0
    };
  }, [processedRoster, getNodes, updateCounter]);
  
  // Publish updates when roster or bandwidth changes
  useEffect(() => {
    // Skip the initial render
    if (lastRosterAllocationsRef.current === '') return;
    
    console.log('[TeamNode] Publishing roster and bandwidth updates to connected nodes');
    
    // Publish update to the observer system so connected nodes (like features) can react
    publishUpdate({
      ...parsedData,
      roster: processedRoster,
      bandwidth: bandwidth
    }, {
      updateType: NodeUpdateType.ALLOCATION,
      affectedFields: ['roster', 'bandwidth'],
      source: 'allocation-change'
    });
  }, [updateCounter, publishUpdate, parsedData, processedRoster, bandwidth]);

  // Dispatch a drag stop event when the node is dragged
  const handleDragStop = useCallback(() => {
    // Dispatch a custom event that feature nodes can listen for
    const event = new CustomEvent('nodeDragStop', { 
      detail: { nodeId: id, nodeType: 'team' }
    });
    window.dispatchEvent(event);
    
    // Also publish an update to the observer system
    publishUpdate({
      ...parsedData,
      roster: processedRoster,
      bandwidth: bandwidth
    }, {
      updateType: NodeUpdateType.POSITION,
      source: 'drag-stop'
    });
  }, [id, publishUpdate, parsedData, processedRoster, bandwidth]);

  // Save season to backend with debouncing
  const saveSeasonToBackend = useCallback(async (season: Season) => {
    if (seasonDebounceRef.current) clearTimeout(seasonDebounceRef.current);
    
    seasonDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ season });
      seasonDebounceRef.current = null;
    }, 1000);
  }, [saveToBackend]);

  // Update title handler with debounce and backend saving
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    
    // Update node data
    updateNodeData(id, { ...data, title: newTitle });
    
    // Clear any existing debounce timer
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set a new debounce timer
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ title: newTitle });
      
      // Ensure roster is an array before publishing
      const safeRoster = Array.isArray(data.roster) ? data.roster : [];
      
      // Publish update to the observer system using the manifest AFTER saving
      publishManifestUpdate({
        ...data,
        title: newTitle,
        roster: safeRoster // Ensure roster is always an array
      }, 
      ['title'], // Specify which fields from the manifest are being updated
      {
        source: 'ui'
      });
      
      titleDebounceRef.current = null;
    }, 1000); // 1 second debounce
  }, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    setDescription(newDescription);
    updateNodeData(id, { ...data, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      await saveToBackend({ description: newDescription });
      
      // Publish update to the observer system using the manifest AFTER saving
      publishManifestUpdate({
        ...data,
        description: newDescription
      }, 
      ['description'], // Specify which fields from the manifest are being updated
      {
        source: 'ui'
      });
      
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);

  // Handle season change
  const handleSeasonChange = useCallback((updates: Partial<Season>) => {
    const defaultSeason: Season = {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      name: 'New Season'
    };

    const updatedSeason = { ...(data.season || defaultSeason), ...updates };
    
    updateNodeData(id, {
      ...data,
      season: updatedSeason
    });
    
    saveSeasonToBackend(updatedSeason);
  }, [id, data, updateNodeData, saveSeasonToBackend]);

  // Update roster handler
  const updateRoster = useCallback((newRoster: RosterMember[]) => {
    // Ensure roster is an array
    const safeRoster = Array.isArray(newRoster) ? newRoster : [];
    
    // Update node data
    updateNodeData(id, { ...data, roster: safeRoster });
    
    // Publish update to the observer system using the manifest
    publishManifestUpdate({
      ...data,
      roster: safeRoster
    }, 
    ['roster'], // Specify which fields from the manifest are being updated
    {
      source: 'ui'
    });
    
    // Save to backend
    saveToBackend({ roster: safeRoster });
  }, [id, data, updateNodeData, saveToBackend, publishManifestUpdate]);

  // Remove roster member
  const removeRosterMember = useCallback((memberId: string) => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
    const updatedRoster = rosterArray.filter((member: RosterMember) => member.memberId !== memberId);
    
    updateNodeData(id, {
      ...data,
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
    
    updateRoster(updatedRoster);
  }, [id, data, updateNodeData, edges, setEdges, processedRoster, updateRoster]);

  // Handle allocation change
  const handleAllocationChange = useCallback((memberId: string, allocation: number) => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(processedRoster) ? processedRoster : [];
    
    // Check if the allocation has actually changed to avoid unnecessary updates
    const currentMember = rosterArray.find((member: RosterMember) => member.memberId === memberId);
    if (currentMember && currentMember.allocation === allocation) {
      return; // No change, exit early
    }
    
    const updatedRoster = rosterArray.map((member: RosterMember) => {
      if (member.memberId === memberId) {
        // Ensure role is a string
        const role = typeof member.role === 'string' ? member.role : 'developer';
        return { 
          ...member, 
          allocation,
          role // Ensure role is included and is a string
        };
      }
      return member;
    });
    
    console.log('[TeamNode] Updated roster after allocation change:', JSON.stringify(updatedRoster));
    
    // Update the UI immediately
    updateNodeData(id, {
      ...data,
      roster: updatedRoster
    });
    
    // Publish update immediately to connected nodes
    publishUpdate({
      ...data,
      roster: updatedRoster
    }, {
      updateType: NodeUpdateType.ALLOCATION,
      affectedFields: ['roster'],
      source: 'direct-allocation-change',
      nodeType: 'team' // Add nodeType to the metadata
    });
    
    // Debounce the backend update
    if (rosterDebounceRef.current) clearTimeout(rosterDebounceRef.current);
    
    rosterDebounceRef.current = setTimeout(async () => {
      try {
        // Save to backend
        await updateRoster(updatedRoster);
        
        // Also update the team member node if it exists
        const teamMember = getNodes().find(n => n.id === memberId);
        if (teamMember) {
          await GraphApiClient.updateNode('teamMember' as NodeType, memberId, { 
            allocation: allocation 
          });
        }
      } catch (error) {
        console.error(`Failed to update team member allocation:`, error);
        toast.error("Failed to update allocation", {
          description: "The team member allocation could not be updated."
        });
      }
    }, 300); // Shorter debounce for better responsiveness
  }, [id, data, updateNodeData, getNodes, processedRoster, updateRoster, publishUpdate]);

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
    if (!data.season) {
      const defaultSeason: Season = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        name: 'New Season'
      };
      
      updateNodeData(id, {
        ...data,
        season: defaultSeason
      });
      
      saveSeasonToBackend(defaultSeason);
    }
  }, [id, data, updateNodeData, saveSeasonToBackend]);

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
          role: (memberNode.data as RFTeamMemberNodeData).roles?.[0] || "Developer",
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
        ...data,
        roster: updatedRoster
      });
      
      // Save to backend
      updateRoster(updatedRoster);
    }
  }, [connections, data, id, updateNodeData, getNodes, processedRoster, updateRoster]);

  // Add a function to trigger bandwidth recalculation
  const triggerBandwidthRecalculation = useCallback(() => {
    setUpdateCounter(prev => prev + 1);
  }, []);

  // Subscribe to updates from other nodes based on manifest
  useEffect(() => {
    if (!id) return;
    
    // Set up subscription based on manifest
    const { unsubscribe } = subscribeBasedOnManifest();
    
    // Listen for node data updates
    const handleNodeDataUpdated = (event: CustomEvent) => {
      const { subscriberId, publisherType, publisherId, relevantFields, data: publisherData } = event.detail;
      
      // Only process events meant for this node
      if (subscriberId !== id) return;
      
      console.log(`Team node ${id} received update from ${publisherType} ${publisherId}:`, {
        relevantFields,
        publisherData
      });
      
      // Handle updates from team member nodes
      if (publisherType === 'teamMember') {
        // If a team member's capacity, roles, or daily rate changes, we may need to update our roster
        if (relevantFields.some((field: string) => ['weeklyCapacity', 'roles', 'dailyRate', 'title'].includes(field))) {
          // Find if this team member is in our roster
          const roster = Array.isArray(parsedData.roster) ? parsedData.roster : [];
          const memberIndex = roster.findIndex(member => member.memberId === publisherId);
          
          if (memberIndex >= 0) {
            // Update the roster with the new information
            console.log(`Updating team roster for member ${publisherId} with new data`);
            
            // Recalculate team bandwidth based on updated member data
            triggerBandwidthRecalculation();
          }
        }
      }
      
      // Handle updates from feature nodes
      if (publisherType === 'feature' && relevantFields.includes('teamAllocations')) {
        // If a feature's team allocations change, we may need to update our bandwidth calculations
        console.log(`Team ${id} received feature allocation update`);
        
        // Recalculate team bandwidth based on updated feature allocations
        triggerBandwidthRecalculation();
      }
    };
    
    window.addEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    };
  }, [id, subscribeBasedOnManifest, parsedData, triggerBandwidthRecalculation]);

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
    season: data.season,
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
    handleDragStop,
    
    // Utilities
    getNodes,
    isTeamMemberNode
  }), [
    title,
    description,
    data.season,
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
    handleDragStop,
    getNodes
  ]);
} 