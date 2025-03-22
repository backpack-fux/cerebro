"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useReactFlow, Edge } from "@xyflow/react";
import { toast } from "sonner";
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { 
  RFFeatureNodeData, 
  BuildType,
  TimeUnit
} from '@/services/graph/feature/feature.types';
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useNodeStatus, NodeStatus } from "@/hooks/useNodeStatus";
import { useDurationInput } from "@/hooks/useDurationInput";
import { useResourceAllocation } from "@/hooks/useResourceAllocation";
import { prepareDataForBackend, parseDataFromBackend, parseJsonIfString } from "@/utils/utils";
import { isFeatureNode } from "@/utils/type-guards";
import { TeamAllocation } from "@/utils/types/allocation";
import { format } from 'date-fns';
import { convertToDays, calculateEndDate } from '@/utils/time/duration';
import { isMemberNode } from '@/utils/node-utils';
import { useNodeObserver } from '@/hooks/useNodeObserver';
import { NodeUpdateType, NodeUpdateMetadata } from '@/services/graph/observer/node-observer';
import { useDurationPublishing } from '@/utils/hooks/useDurationPublishing';

// Add these interfaces at the top of the file after imports
interface TeamMember {
  memberId: string;
  name: string;
  allocation?: number;
  weeklyCapacity?: number;
}

interface TeamRoster {
  roster?: TeamMember[];
  title?: string;
  bandwidth?: {
    total?: number;
    available?: number;
    allocated?: number;
  };
}

// Extended TeamAllocation interface with bandwidth properties
interface ExtendedTeamAllocation extends TeamAllocation {
  teamBandwidth?: number;
  availableBandwidth?: number;
  teamName?: string;
}

// Add NodeDataEvent type at the top with other interfaces
interface NodeDataEvent extends CustomEvent {
  detail: {
    subscriberId: string;
    subscriberType: string;
    publisherId: string;
    publisherType: string;
    relevantFields: string[];
    data: unknown;
  };
}

// Add ExtendedRFFeatureNodeData interface
interface ExtendedRFFeatureNodeData extends RFFeatureNodeData {
  status?: NodeStatus;
}

/**
 * @function useFeatureNode
 * @description Custom hook for managing feature node state and operations. This hook provides a centralized
 * interface for handling all feature node data and interactions, including data persistence, update publishing,
 * and UI state management. It incorporates specialized publishing mechanisms for duration, member allocation,
 * and date handling with protection against circular updates.
 * 
 * @param {string} id - The unique identifier for the feature node
 * @param {RFFeatureNodeData} data - The initial data for the feature node from React Flow
 * 
 * @returns {Object} Feature node state and operations
 * @property {string} title - Current title of the feature node
 * @property {string} description - Current description of the feature node
 * @property {BuildType} buildType - Current build type (internal/external)
 * @property {number} duration - Current duration in time units
 * @property {string} timeUnit - Current time unit (e.g., days, weeks)
 * @property {string} startDate - Planned start date in ISO format
 * @property {string} endDate - Planned end date in ISO format
 * @property {boolean} isLoading - Loading state indicator
 * @property {function} handleTitleChange - Handler for title changes
 * @property {function} handleDescriptionChange - Handler for description changes
 * @property {function} handleBuildTypeChange - Handler for build type changes
 * @property {function} handleDurationChange - Handler for duration changes
 * @property {function} handleDelete - Function to delete the feature node
 * @property {function} refreshData - Function to refresh node data from the backend
 * @property {function} refreshConnectedTeamData - Function to refresh connected team data
 * @property {function} calculateMemberAllocations - Function to calculate member allocations
 * @property {function} updateStartDate - Function to update the start date
 * @property {function} updateEndDate - Function to update the end date
 * @property {function} handleTimeUnitChange - Handler for time unit changes
 * @property {Array<TeamAllocation>} processedTeamAllocations - Processed team allocations
 * @property {Map<string, Object>} memberAllocations - Map of member allocations
 * @property {Array<Object>} connectedTeams - List of connected teams
 */
export function useFeatureNode(id: string, data: RFFeatureNodeData) {
  const { getNodes, setNodes, setEdges, updateNodeData, getEdges } = useReactFlow();
  const teamAllocationHook = useTeamAllocation(id, data);
  const { processedTeamAllocations, costs } = teamAllocationHook;
  
  // Track if we've loaded data from the server
  const initialFetchCompletedRef = useRef(false);
  
  // Refs for debouncing
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const buildTypeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const durationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const startDateRef = useRef<NodeJS.Timeout | null>(null);
  const endDateRef = useRef<NodeJS.Timeout | null>(null);
  
  // Replace the jsonFields constant with a useMemo
  const jsonFields = useMemo(() => ['teamAllocations', 'memberAllocations', 'teamMembers', 'availableBandwidth'], []);
  
  // Parse complex objects if they are strings
  const parsedData = useMemo(() => {
    return parseDataFromBackend(data, jsonFields) as ExtendedRFFeatureNodeData;
  }, [data, jsonFields]);
  
  // State for the feature node
  const [title, setTitle] = useState(parsedData.title || '');
  const [description, setDescription] = useState(parsedData.description || '');
  const [buildType, setBuildType] = useState<BuildType>(parsedData.buildType || 'internal');
  const [isLoading, setIsLoading] = useState(false);
  
  // Use the node observer hook for published updates and subscriptions
  const { 
    publishManifestUpdate,
    subscribeBasedOnManifest
  } = useNodeObserver<RFFeatureNodeData>(id, 'feature');
  
  // Create a map to track the last update time for each field to prevent circular updates
  const lastUpdateTimestampRef = useRef<Map<string, number>>(new Map());
  
  /**
   * @function safePublishUpdate
   * @description Safely publishes node updates while preventing circular updates through
   * timestamp tracking. This function is a wrapper around publishManifestUpdate that adds
   * protection mechanisms to avoid update loops.
   * 
   * @param {RFFeatureNodeData} data - The data to publish
   * @param {string[]} fields - Array of field names that were updated
   * @param {Partial<NodeUpdateMetadata>} metadata - Optional metadata about the update
   * @returns {void}
   */
  // Safe wrapper for publishManifestUpdate to prevent circular updates
  const safePublishUpdate = useCallback((
    data: RFFeatureNodeData,
    fields: string[],
    metadata: Partial<NodeUpdateMetadata> = {}
  ) => {
    // More aggressive caching for updates - use 500ms buffer to prevent rapid updates
    const bufferMs = 500;
    
    // Log all updates for debugging excessive network calls
    console.log(`[FeatureNode][${id}] Checking publish for fields:`, {
      fields,
      timestamp: Date.now(),
      metadata
    });
    
    // Check if any field has been updated too recently
    const hasTooRecentUpdate = fields.some(field => {
      const lastUpdate = lastUpdateTimestampRef.current.get(field) || 0;
      const timeSinceLastUpdate = Date.now() - lastUpdate;
      
      // If the last update was very recent, consider it a potential loop
      if (timeSinceLastUpdate < bufferMs) {
        console.log(`[FeatureNode][${id}] 🛑 Skipping potential circular update for ${field}, last update was ${timeSinceLastUpdate}ms ago`);
        return true;
      }
      
      // Update the timestamp
      lastUpdateTimestampRef.current.set(field, Date.now());
      return false;
    });
    
    if (hasTooRecentUpdate) return;
    
    // Safe to publish the update
    publishManifestUpdate(data, fields, metadata);
  }, [publishManifestUpdate, id]);
  
  // Move calculateMemberCapacity before calculateTeamBandwidth
  const calculateMemberCapacity = useCallback((member: TeamMember) => {
    // Implementation of member capacity calculation
    const allocation = member.allocation || 0;
    const weeklyCapacity = member.weeklyCapacity || 40;
    return (allocation / 100) * weeklyCapacity;
  }, []);
  
  const calculateTeamBandwidth = useCallback((roster: TeamMember[]) => {
    // Ensure roster is an array before using array methods
    if (!roster || !Array.isArray(roster)) {
      console.warn('[FeatureNode] calculateTeamBandwidth received invalid roster:', roster);
      return 0; // Return 0 if roster is not an array
    }
    
    // Implementation of team bandwidth calculation
    return roster.reduce((total, member) => {
      // Calculate member capacity and add to total
      return total + calculateMemberCapacity(member);
    }, 0);
  }, [calculateMemberCapacity]);

  // Replace the ensureValidBuildType function with a useCallback
  const ensureValidBuildType = useCallback((type: string | undefined): BuildType => {
    // Default to 'internal' if type is undefined, empty, or not one of the valid options
    const validTypes: BuildType[] = ['internal', 'external'];
    return (type && validTypes.includes(type as BuildType)) ? (type as BuildType) : 'internal';
  }, []);

  /**
   * @function saveToBackend
   * @description Persists feature node updates to the backend with protection mechanisms against
   * circular updates. This function handles data transformation, API calls, state updates, and
   * manifest publishing in a coordinated way.
   * 
   * Features:
   * - Debounces similar updates to reduce API calls
   * - Tracks update timestamps to prevent circular updates
   * - Transforms data between React Flow and Neo4j formats
   * - Handles JSON field serialization/deserialization
   * - Updates React Flow state after successful backend save
   * - Publishes updates to subscribers via the manifest system
   * 
   * @param {Partial<RFFeatureNodeData>} updates - The data updates to persist
   * @returns {Promise<boolean>} Success status of the operation
   */
  // Save to backend function
  const saveToBackend = useCallback(async (updates: Partial<RFFeatureNodeData>) => {
    try {
      // Track fields being updated to prevent duplicate saves
      const updateFields = Object.keys(updates);
      
      // Check if we've recently saved any of these fields (within 1 second)
      const recentlySavedField = updateFields.find(field => {
        const lastSave = lastUpdateTimestampRef.current.get(`save_${field}`) || 0;
        const timeSinceLastSave = Date.now() - lastSave;
        return timeSinceLastSave < 1000; // 1 second debounce for backend saves
      });
      
      if (recentlySavedField) {
        console.log(`[FeatureNode][${id}] 🛑 Skipping redundant save, field "${recentlySavedField}" was just saved`);
        return true; // Pretend it succeeded to avoid error flows
      }
      
      // Enhanced logging for date persistence debugging
      console.log(`[FeatureNode][${id}] Saving to backend:`, {
        updates,
        keys: updateFields,
        hasStartDate: 'startDate' in updates,
        startDateValue: updates.startDate,
        hasEndDate: 'endDate' in updates,
        endDateValue: updates.endDate,
        source: new Error().stack?.split('\n')[2]?.trim() || 'unknown'
      });
      
      // Prepare data for backend by stringifying JSON fields
      const apiData = prepareDataForBackend(updates, jsonFields);
      
      // Log the actual data being sent to the backend
      console.log(`[FeatureNode][${id}] Sending to API:`, {
        apiData,
        startDate: apiData.startDate,
        endDate: apiData.endDate
      });
      
      // Send to backend
      await GraphApiClient.updateNode('feature' as NodeType, id, apiData);
      console.log(`[FeatureNode][${id}] ✅ Updated feature node:`, updates);
      
      // Mark these fields as recently saved
      updateFields.forEach(field => {
        lastUpdateTimestampRef.current.set(`save_${field}`, Date.now());
      });
      
      // Update React Flow state after successful backend save to ensure consistency
      updateNodeData(id, updates);
      
      // Publish the update to subscribers using the manifest system
      // This ensures other nodes that depend on this data are notified
      const updatedData = { ...parsedData, ...updates };
      safePublishUpdate(
        updatedData,
        updateFields,
        { updateType: NodeUpdateType.CONTENT }
      );
      
      return true;
    } catch (error) {
      console.error(`[FeatureNode][${id}] Failed to update feature node:`, error);
      toast.error(`Update Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [id, jsonFields, parsedData, safePublishUpdate, updateNodeData]);
  
  // Reset the initialFetchCompletedRef when the ID changes
  useEffect(() => {
    initialFetchCompletedRef.current = false;
  }, [id]);
  
  // Function to refresh data from connected team nodes
  const refreshConnectedTeamData = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    
    console.log(`[FeatureNode][${id}] Starting refreshConnectedTeamData, current teamAllocations:`, {
      teamAllocationsType: typeof parsedData.teamAllocations,
      teamAllocationsIsArray: Array.isArray(parsedData.teamAllocations),
      teamAllocationsLength: Array.isArray(parsedData.teamAllocations) ? 
        parsedData.teamAllocations.length : 0,
      source: 'refreshConnectedTeamData-start'
    });
    
    // Find all connected team nodes
    const connectedTeamIds = edges
      .filter((edge: Edge) => edge.source === id || edge.target === id)
      .map((edge: Edge) => edge.source === id ? edge.target : edge.source)
      .filter((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node && node.type === 'team';
      });
    
    if (connectedTeamIds.length === 0) return;
    
    console.log(`[FeatureNode] Refreshing data from ${connectedTeamIds.length} connected team nodes`);
    
    // Get current team allocations
    const currentAllocations = parseJsonIfString<ExtendedTeamAllocation[]>(parsedData.teamAllocations, []);
    let hasUpdates = false;
    
    // Update allocations with latest team data
    const updatedAllocations = currentAllocations.map(allocation => {
      // Find the team node
      const teamNode = nodes.find(n => n.id === allocation.teamId && n.type === 'team');
      if (!teamNode) return allocation;
      
      // Get team data
      const teamData = teamNode.data as TeamRoster;
      
      // Ensure roster is an array
      const roster = teamData.roster && Array.isArray(teamData.roster) 
        ? teamData.roster 
        : [];
      
      // Calculate team bandwidth
      const teamBandwidth = teamData.bandwidth?.total || 
                           calculateTeamBandwidth(roster);
      
      // Calculate available bandwidth
      const availableBandwidth = teamData.bandwidth?.available || 
                               (teamBandwidth - (teamData.bandwidth?.allocated || 0));
      
      // Check if team name has changed
      const teamNameChanged = teamData.title && allocation.teamName !== teamData.title;
      
      // Check if any member names need updating
      const updatedMembers = allocation.allocatedMembers.map(member => {
        // Find the member node
        const memberNode = nodes.find(n => n.id === member.memberId && n.type === 'teamMember');
        if (!memberNode || memberNode.data.title === member.name) {
          return member;
        }
        
        // Update member name if it has changed, but preserve hours!
        hasUpdates = true;
        return {
          ...member,
          name: String(memberNode.data.title || member.name)
        };
      });
      
      // Only update metadata (name, bandwidth) if values have changed, preserve allocation hours!
      if (allocation.teamBandwidth !== teamBandwidth || 
          allocation.availableBandwidth !== availableBandwidth ||
          teamNameChanged ||
          updatedMembers !== allocation.allocatedMembers) {
        hasUpdates = true;
        return {
          ...allocation,
          teamBandwidth,
          availableBandwidth,
          teamName: teamData.title || allocation.teamName,
          allocatedMembers: updatedMembers
        };
      }
      
      return allocation;
    });
    
    console.log(`[FeatureNode][${id}] refreshConnectedTeamData result:`, {
      hasUpdates,
      originalLength: currentAllocations.length,
      updatedLength: updatedAllocations.length,
      firstItemHours: updatedAllocations.length > 0 && updatedAllocations[0].allocatedMembers.length > 0 ?
        updatedAllocations[0].allocatedMembers[0].hours : 'none',
      source: 'refreshConnectedTeamData-result'
    });
    
    // Update node data if there were changes
    if (hasUpdates) {
      // Preserve the existing allocated hours in each team allocation
      updateNodeData(id, {
        ...parsedData,
        teamAllocations: updatedAllocations as unknown as TeamAllocation[]
      });
      
      // Save to backend
      saveToBackend({
        teamAllocations: updatedAllocations as unknown as TeamAllocation[]
      });
      
      // Publish the update to subscribers using the manifest system
      safePublishUpdate(
        { 
          ...parsedData, 
          teamAllocations: updatedAllocations as unknown as TeamAllocation[] 
        },
        ['teamAllocations', 'teamAllocation_allocatedMembers'],
        { updateType: NodeUpdateType.CONTENT }
      );
    }
  }, [id, parsedData, getNodes, getEdges, updateNodeData, calculateTeamBandwidth, saveToBackend, safePublishUpdate]);
  
  // Function to refresh data from the server
  const refreshData = useCallback(async () => {
    if (GraphApiClient.isNodeBlacklisted(id)) return;
    
    try {
      setIsLoading(true);
      
      console.log(`[FeatureNode][${id}] Starting refresh, current teamAllocations:`, {
        teamAllocationsType: typeof parsedData.teamAllocations,
        teamAllocationsIsArray: Array.isArray(parsedData.teamAllocations),
        teamAllocationsLength: Array.isArray(parsedData.teamAllocations) ? 
          parsedData.teamAllocations.length : 0,
        source: 'refreshData-start'
      });
      
      const serverData = await GraphApiClient.getNode('feature' as NodeType, id);
      
      // Type-check and assert the shape of the returned data
      if (!serverData || typeof serverData !== 'object') {
        throw new Error('Invalid server data received');
      }
      
      // Create a properly typed server data object
      const typedServerData = serverData as {
        title?: string;
        description?: string;
        buildType?: string;
        teamAllocations?: string | TeamAllocation[];
        startDate?: string;
        endDate?: string;
        duration?: number;
        status?: string;
      };
      
      // Verify that we're working with a feature node in case the API returns a different type
      const nodeFromGraph = getNodes().find(n => n.id === id);
      if (nodeFromGraph && !isFeatureNode(nodeFromGraph)) {
        console.warn(`Node ${id} exists but is not a feature node. Type: ${nodeFromGraph.type}`);
      }
      
      // Process team allocations using parseJsonIfString utility
      const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(typedServerData.teamAllocations, []);
      
      console.log(`[FeatureNode][${id}] Server returned teamAllocations:`, {
        rawType: typeof typedServerData.teamAllocations,
        processedType: typeof processedTeamAllocations,
        processedIsArray: Array.isArray(processedTeamAllocations),
        processedLength: Array.isArray(processedTeamAllocations) ? 
          processedTeamAllocations.length : 0,
        firstItem: processedTeamAllocations.length > 0 ? 
          processedTeamAllocations[0].teamId : 'none',
        source: 'refreshData-server'
      });
      
      // Ensure buildType is valid
      const validBuildType = ensureValidBuildType(typedServerData.buildType);
      
      // Update local state with all server data
      setTitle(typedServerData.title || '');
      setDescription(typedServerData.description || '');
      setBuildType(validBuildType);
      
      // Don't overwrite existing allocations if server returns empty
      const finalTeamAllocations = processedTeamAllocations.length === 0 && 
                               Array.isArray(parsedData.teamAllocations) && 
                               parsedData.teamAllocations.length > 0 ? 
                             parsedData.teamAllocations : processedTeamAllocations;
      
      console.log(`[FeatureNode][${id}] Final teamAllocations to use:`, {
        isArray: Array.isArray(finalTeamAllocations),
        length: finalTeamAllocations.length,
        source: 'refreshData-final'
      });
      
      // Update node data in ReactFlow
      const updatedNodeData = {
        ...parsedData,
        title: typedServerData.title || parsedData.title,
        description: typedServerData.description || parsedData.description,
        buildType: validBuildType,
        teamAllocations: finalTeamAllocations,
        duration: typedServerData.duration
      };
      
      // Explicitly handle start and end dates to ensure they persist
      if (typedServerData.startDate) {
        updatedNodeData.startDate = typedServerData.startDate;
        datesPersistenceRef.current.startDate = typedServerData.startDate || null;
        console.log(`[FeatureNode][${id}] Setting startDate from server:`, typedServerData.startDate);
      }
      
      if (typedServerData.endDate) {
        updatedNodeData.endDate = typedServerData.endDate;
        datesPersistenceRef.current.endDate = typedServerData.endDate || null;
        console.log(`[FeatureNode][${id}] Setting endDate from server:`, typedServerData.endDate);
      }
      
      // Update the node data
      updateNodeData(id, updatedNodeData);
      
      // Log the final node data
      console.log(`[FeatureNode][${id}] Final node data after loading:`, {
        title: updatedNodeData.title,
        startDate: updatedNodeData.startDate,
        endDate: updatedNodeData.endDate,
        hasStartDate: Boolean(updatedNodeData.startDate),
        hasEndDate: Boolean(updatedNodeData.endDate)
      });

      // Also refresh data from connected team nodes to ensure team names and member names are up to date
      refreshConnectedTeamData();
      
    } catch (error) {
      console.error(`Error refreshing node data for ${id}:`, error);
      toast.error(`Failed to refresh feature ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [id, parsedData, updateNodeData, ensureValidBuildType, getNodes, refreshConnectedTeamData]);
  
  // Use effect to initialize data from server
  useEffect(() => {
    if (isLoading || initialFetchCompletedRef.current) return;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        if (GraphApiClient.isNodeBlacklisted(id)) {
          initialFetchCompletedRef.current = true;
          return;
        }
        
        try {
          console.log(`[FeatureNode][${id}] Fetching data from server...`);
          const serverData = await GraphApiClient.getNode('feature' as NodeType, id);
          
          // Type-check and assert the shape of the returned data
          if (!serverData || typeof serverData !== 'object') {
            throw new Error('Invalid server data received');
          }
          
          console.log(`[FeatureNode][${id}] Raw server data received:`, {
            id: serverData.id,
            title: serverData.title,
            teamAllocationsType: serverData.teamAllocations ? 
              typeof serverData.teamAllocations : 'undefined',
            teamAllocationsIsArray: serverData.teamAllocations ? 
              Array.isArray(serverData.teamAllocations) : false,
            teamAllocationsLength: serverData.teamAllocations && Array.isArray(serverData.teamAllocations) ? 
              serverData.teamAllocations.length : 0,
            startDate: serverData.startDate,
            endDate: serverData.endDate,
            hasStartDate: Boolean(serverData.startDate),
            hasEndDate: Boolean(serverData.endDate)
          });
          
          // Create a properly typed server data object
          const typedServerData = serverData as {
            title?: string;
            description?: string;
            buildType?: string;
            teamAllocations?: string | TeamAllocation[];
            startDate?: string;
            endDate?: string;
            duration?: number;
            status?: string;
          };
          
          // Process team allocations using parseJsonIfString utility
          const processedTeamAllocations = parseJsonIfString<TeamAllocation[]>(typedServerData.teamAllocations, []);
          
          console.log(`[FeatureNode][${id}] Processed team allocations:`, {
            isArray: Array.isArray(processedTeamAllocations),
            length: Array.isArray(processedTeamAllocations) ? processedTeamAllocations.length : 0,
            firstItem: processedTeamAllocations && processedTeamAllocations.length > 0 ? 
              { 
                teamId: processedTeamAllocations[0].teamId,
                requestedHours: processedTeamAllocations[0].requestedHours,
                allocatedMembersCount: processedTeamAllocations[0].allocatedMembers?.length || 0
              } : 'none'
          });
          
          // Don't overwrite existing allocations if server returns empty but we have data locally
          const existingAllocations = parseJsonIfString<TeamAllocation[]>(parsedData.teamAllocations, []);
          
          const finalTeamAllocations = processedTeamAllocations.length === 0 && 
                                   existingAllocations.length > 0 ? 
                                 existingAllocations : processedTeamAllocations;
          
          console.log(`[FeatureNode][${id}] Final team allocations to use:`, {
            source: 'fetchData',
            existingLength: existingAllocations.length,
            processedLength: processedTeamAllocations.length,
            finalLength: finalTeamAllocations.length,
            willUseExisting: processedTeamAllocations.length === 0 && existingAllocations.length > 0
          });
          
          // Ensure buildType is valid
          const validBuildType = ensureValidBuildType(typedServerData.buildType);
          
          // Update local state with all server data
          setTitle(typedServerData.title || '');
          setDescription(typedServerData.description || '');
          setBuildType(validBuildType);
          
          // Update node data in ReactFlow
          const updatedNodeData = {
            ...parsedData,
            title: typedServerData.title || parsedData.title,
            description: typedServerData.description || parsedData.description,
            buildType: validBuildType,
            teamAllocations: finalTeamAllocations,
            duration: typedServerData.duration
          };
          
          // Explicitly handle start and end dates to ensure they persist
          if (typedServerData.startDate) {
            updatedNodeData.startDate = typedServerData.startDate;
            datesPersistenceRef.current.startDate = typedServerData.startDate || null;
            console.log(`[FeatureNode][${id}] Setting startDate from server:`, typedServerData.startDate);
          }
          
          if (typedServerData.endDate) {
            updatedNodeData.endDate = typedServerData.endDate;
            datesPersistenceRef.current.endDate = typedServerData.endDate || null;
            console.log(`[FeatureNode][${id}] Setting endDate from server:`, typedServerData.endDate);
          }
          
          // Update the node data
          updateNodeData(id, updatedNodeData);
          
          // Log the final node data
          console.log(`[FeatureNode][${id}] Final node data after loading:`, {
            title: updatedNodeData.title,
            startDate: updatedNodeData.startDate,
            endDate: updatedNodeData.endDate,
            hasStartDate: Boolean(updatedNodeData.startDate),
            hasEndDate: Boolean(updatedNodeData.endDate)
          });
          
        } catch (error) {
          console.error(`Error fetching node data for ${id}:`, error);
          
          // If the node doesn't exist, we should still mark it as initialized
          if (error instanceof Error && error.message.includes('404')) {
            console.warn(`Node ${id} not found, marking as initialized anyway`);
          } else {
            toast.error(`Failed to load feature ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } finally {
        setIsLoading(false);
        initialFetchCompletedRef.current = true;
      }
    };
    
    fetchData();
  }, [id, parsedData, updateNodeData, isLoading, ensureValidBuildType]);
  
  // Update local state when data changes from the props
  useEffect(() => {
    // Only update if we're not loading and the initial fetch is complete
    if (!isLoading && initialFetchCompletedRef.current) {
      // Check if the data has changed to avoid unnecessary updates
      if (title !== parsedData.title) {
        setTitle(parsedData.title || '');
      }
      
      if (description !== parsedData.description) {
        setDescription(parsedData.description || '');
      }
      
      const validBuildType = ensureValidBuildType(parsedData.buildType);
      if (buildType !== validBuildType) {
        setBuildType(validBuildType);
      }

      // Log any unexpected teamAllocations changes that might be overwriting our data
      const currentTeamAllocations = parseJsonIfString<TeamAllocation[]>(parsedData.teamAllocations, []);
      console.log(`[FeatureNode][${id}] ALLOCATION CHECK - Current team allocations in parsedData:`, {
        isArray: Array.isArray(currentTeamAllocations),
        length: Array.isArray(currentTeamAllocations) ? currentTeamAllocations.length : 0,
        source: 'prop update effect',
        stack: new Error().stack
      });
    }
  }, [parsedData.title, parsedData.description, parsedData.buildType, parsedData.teamAllocations, isLoading, title, description, buildType, ensureValidBuildType, id]);
  
  // Add a separate effect to detect and recover from allocation data loss
  useEffect(() => {
    // Skip if we're still loading or haven't completed the initial fetch
    if (isLoading || !initialFetchCompletedRef.current) {
      return;
    }
    
    // Check if we have a node with missing allocations 
    // (expected to have allocations but actually empty)
    const teamAllocations = parseJsonIfString<TeamAllocation[]>(parsedData.teamAllocations, []);
    
    // Condition 1: We have team connections but no allocations
    const edges = getEdges();
    const connectedTeamCount = edges.filter(edge => 
      (edge.source === id || edge.target === id) && 
      getNodes().some(n => (n.id === edge.source || n.id === edge.target) && n.type === 'team')
    ).length;
    
    // If we have connected teams but no allocations, something might be wrong
    const hasConnectedTeamsButNoAllocations = connectedTeamCount > 0 && teamAllocations.length === 0;
    
    if (hasConnectedTeamsButNoAllocations) {
      console.log(`[FeatureNode][${id}] ⚠️ Detected connected teams (${connectedTeamCount}) but no allocations, triggering recovery...`);
      
      // Try to recover by explicitly refreshing data
      // Use a short delay to ensure we're not in a refresh loop
      const recoveryTimer = setTimeout(() => {
        refreshData();
      }, 500);
      
      return () => clearTimeout(recoveryTimer);
    }
  }, [id, isLoading, parsedData.teamAllocations, refreshData, getEdges, getNodes]);
  
  // Use the resource allocation hook to manage resource allocations with standardized publishing
  const resourceAllocation = useResourceAllocation(
    id,
    'feature',
    parsedData,
    teamAllocationHook,
    getNodes,
    // Cast to resolve compatibility issue between NodeData and RFFeatureNodeData
    safePublishUpdate as unknown as (data: Partial<RFFeatureNodeData>) => Promise<void>
  );
  
  // Use the node status hook to manage status
  const { status, getStatusColor, cycleStatus } = useNodeStatus(
    id, 
    parsedData, 
    updateNodeData, 
    {
      canBeActive: true,
      defaultStatus: 'planning'
    }
  );
  
  // Use the duration input hook to manage duration
  const duration = useDurationInput(
    id, 
    parsedData, 
    updateNodeData,
    {
      maxDays: 180,
      label: 'Time to Complete',
      fieldName: 'duration',
      tip: 'Use "d" for days or "w" for weeks.',
    }
  );

  // Extract functions from the duration hook
  const { handleDurationChange } = duration;

  // Use the standardized duration publishing hook
  const durationPublishing = useDurationPublishing(
    id, 
    'feature', 
    parsedData, 
    safePublishUpdate,
    { 
      fieldName: 'duration',
      debugName: 'FeatureNode'
    }
  );

  // Override the handleDurationChange to include publishing updates
  const handleDurationChangeWithPublish = useCallback((value: string) => {
    // Use the standardized handler
    durationPublishing.handleDurationChange(value, handleDurationChange);
  }, [handleDurationChange, durationPublishing]);

  // Handle time unit change
  const handleTimeUnitChange = useCallback((newTimeUnit: string) => {
    // Cast to TimeUnit for type safety
    const validTimeUnit = newTimeUnit as TimeUnit;
    updateNodeData(id, { ...parsedData, timeUnit: validTimeUnit });
    saveToBackend({ timeUnit: validTimeUnit });
  }, [id, parsedData, updateNodeData, saveToBackend]);

  // Request team allocation - delegate to the team allocation hook
  const requestTeamAllocation = useCallback((
    teamId: string, 
    requestedHours: number, 
    memberData: TeamMember[] = []
  ) => {
    return teamAllocationHook.requestTeamAllocation(teamId, requestedHours, memberData);
  }, [teamAllocationHook]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    // Skip if title hasn't changed
    if (newTitle === title) {
      return;
    }
    
    // Update local state first
    setTitle(newTitle);
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, title: newTitle });
    
    // Clear existing timeout
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    // Check if we just saved the title recently (within 2 seconds)
    const lastTitleSave = lastUpdateTimestampRef.current.get('save_title') || 0;
    const timeSinceLastSave = Date.now() - lastTitleSave;
    
    if (timeSinceLastSave < 2000) {
      console.log(`[FeatureNode][${id}] 🛑 Skipping title save - just saved ${timeSinceLastSave}ms ago`);
      return;
    }
    
    // Debounce the save to backend
    titleDebounceRef.current = setTimeout(() => {
      console.log(`[FeatureNode][${id}] 💾 Saving title = "${newTitle}" to backend`);
      
      saveToBackend({ title: newTitle })
        .then(() => {
          // Mark title as recently saved
          lastUpdateTimestampRef.current.set('save_title', Date.now());
          
          // Publish the update to subscribers using the manifest system
          safePublishUpdate(
            { ...parsedData, title: newTitle },
            ['title'],
            { updateType: NodeUpdateType.CONTENT, source: 'title-update' }
          );
        })
        .finally(() => {
          titleDebounceRef.current = null;
        });
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend, safePublishUpdate, title]);

  // Handle description change
  const handleDescriptionChange = useCallback((newDescription: string) => {
    // Skip if description hasn't changed
    if (newDescription === description) {
      return;
    }
    
    // Update local state first
    setDescription(newDescription);
    
    // Then update ReactFlow state immediately to maintain UI responsiveness
    updateNodeData(id, { ...parsedData, description: newDescription });
    
    // Clear existing timeout
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    // Check if we just saved the description recently (within 2 seconds)
    const lastDescriptionSave = lastUpdateTimestampRef.current.get('save_description') || 0;
    const timeSinceLastSave = Date.now() - lastDescriptionSave;
    
    if (timeSinceLastSave < 2000) {
      console.log(`[FeatureNode][${id}] 🛑 Skipping description save - just saved ${timeSinceLastSave}ms ago`);
      return;
    }
    
    // Debounce the save to backend
    descriptionDebounceRef.current = setTimeout(() => {
      // Log to help diagnose the issue
      console.log(`[FeatureNode][${id}] 💾 Saving description to backend:`, {
        current: parsedData.description,
        new: newDescription,
        length: newDescription.length
      });
      
      saveToBackend({ description: newDescription })
        .then(() => {
          // Mark description as recently saved
          lastUpdateTimestampRef.current.set('save_description', Date.now());
          
          // Publish the update to subscribers using the manifest system
          safePublishUpdate(
            { ...parsedData, description: newDescription },
            ['description'],
            { updateType: NodeUpdateType.CONTENT, source: 'description-update' }
          );
        })
        .finally(() => {
          descriptionDebounceRef.current = null;
        });
    }, 1000);
  }, [id, parsedData, updateNodeData, saveToBackend, safePublishUpdate, description]);

  // Handle build type change
  const handleBuildTypeChange = useCallback((newBuildType: BuildType) => {
    // Ensure the new build type is valid
    if (!['internal', 'external'].includes(newBuildType)) {
      console.warn(`Invalid build type: ${newBuildType}`);
      return;
    }

    // Update node data with the new build type
    updateNodeData(id, { ...parsedData, buildType: newBuildType });

    // Save to backend
    saveToBackend({ buildType: newBuildType });

    // Publish the update to subscribers using the manifest system
    safePublishUpdate(
      { ...parsedData, buildType: newBuildType },
      ['buildType'],
      { updateType: NodeUpdateType.CONTENT }
    );
  }, [id, parsedData, updateNodeData, saveToBackend, safePublishUpdate]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    GraphApiClient.deleteNode('feature' as NodeType, id)
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        setEdges((edges) => {
          const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
          connectedEdges.forEach((edge) => {
            GraphApiClient.deleteEdge('feature' as NodeType, edge.id)
              .catch((error) => console.error(`Failed to delete edge ${edge.id}:`, error));
          });
          return edges.filter((edge) => edge.source !== id && edge.target !== id);
        });
      })
      .catch((error) => {
        console.error(`Failed to delete feature node ${id}:`, error);
        toast.error("The feature couldn't be deleted from the database.");
      });
  }, [id, setNodes, setEdges]);

  // Save duration to backend when it changes
  useEffect(() => {
    // Since we're now handling duplicate calls in saveToBackend, skip if the duration
    // was recently updated or we've already seen this value
    const lastDurationSave = lastUpdateTimestampRef.current.get('save_duration') || 0;
    const timeSinceLastSave = Date.now() - lastDurationSave;
    
    // Skip if we just saved this within the last 2 seconds
    if (timeSinceLastSave < 2000) {
      console.log(`[FeatureNode][${id}] 🛑 Skipping saveToBackend for duration - saved ${timeSinceLastSave}ms ago`);
      return;
    }
    
    // Update the timestamp immediately to prevent additional calls
    lastUpdateTimestampRef.current.set('save_duration', Date.now());
    
    // Use the standardized saveToBackend function
    return durationPublishing.saveToBackend();
  }, [parsedData.duration, durationPublishing, id]);

  // Add ref to track if we've already saved the dates to prevent loops
  const datesPersistenceRef = useRef({
    startDate: null as string | null | undefined,
    endDate: null as string | null | undefined,
    saving: false
  });

  // Add effect to ensure start and end dates persist on refresh
  useEffect(() => {
    // Only run if we have loaded data and have valid dates
    if (!initialFetchCompletedRef.current) return;
    
    // Prevent saving if we're already saving or if there's no meaningful change
    if (datesPersistenceRef.current.saving) return;
    
    // Check if there's a meaningful change in dates
    const startDateChanged = parsedData.startDate !== datesPersistenceRef.current.startDate;
    const endDateChanged = parsedData.endDate !== datesPersistenceRef.current.endDate;
    
    // Only save if we have valid dates and they've changed
    if (!parsedData.startDate || !parsedData.endDate || (!startDateChanged && !endDateChanged)) {
      return;
    }
    
    // Check if we've recently saved these values (within last 2 seconds)
    const lastStartDateSave = lastUpdateTimestampRef.current.get('save_startDate') || 0;
    const lastEndDateSave = lastUpdateTimestampRef.current.get('save_endDate') || 0;
    const startDateRecentlySaved = Date.now() - lastStartDateSave < 2000;
    const endDateRecentlySaved = Date.now() - lastEndDateSave < 2000;
    
    if (startDateRecentlySaved && endDateRecentlySaved) {
      console.log(`[FeatureNode][${id}] 🛑 Skipping date persistence save - dates were recently saved`);
      return;
    }
    
    // Save start date and end date to backend to ensure they persist, but only if changed
    const saveStartEndDates = async () => {
      console.log(`[FeatureNode][${id}] 💾 Saving dates for persistence:`, {
        startDate: parsedData.startDate,
        endDate: parsedData.endDate,
        previousStartDate: datesPersistenceRef.current.startDate,
        previousEndDate: datesPersistenceRef.current.endDate,
      });
      
      // Mark as saving to prevent reentrance
      datesPersistenceRef.current.saving = true;
      
      await saveToBackend({
        startDate: parsedData.startDate,
        endDate: parsedData.endDate,
      });
      
      // Update saved values
      datesPersistenceRef.current.startDate = parsedData.startDate || null;
      datesPersistenceRef.current.endDate = parsedData.endDate || null;
      
      // Reset saving flag
      datesPersistenceRef.current.saving = false;
    };
    
    saveStartEndDates();
  }, [id, parsedData.startDate, parsedData.endDate, saveToBackend]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const currentBuildTypeTimeout = buildTypeDebounceRef.current;
    const currentDurationDebounce = durationDebounceRef.current;
    const currentStartDateRef = startDateRef.current;
    const currentEndDateRef = endDateRef.current;
    const currentTitleDebounce = titleDebounceRef.current;
    const currentDescriptionDebounce = descriptionDebounceRef.current;
    
    return () => {
      if (currentTitleDebounce) clearTimeout(currentTitleDebounce);
      if (currentDescriptionDebounce) clearTimeout(currentDescriptionDebounce);
      if (currentBuildTypeTimeout) clearTimeout(currentBuildTypeTimeout);
      if (currentDurationDebounce) clearTimeout(currentDurationDebounce);
      if (currentStartDateRef) clearTimeout(currentStartDateRef);
      if (currentEndDateRef) clearTimeout(currentEndDateRef);
    };
  }, []);

  // Add fields for startDate and endDate to the feature node data
  const startDate = useMemo(() => {
    // First check if the data loaded from backend has a startDate
    if (parsedData.startDate && typeof parsedData.startDate === 'string') {
      return parsedData.startDate;
    }
    
    // If not, create a default startDate
    const now = new Date();
    return format(now, 'yyyy-MM-dd');
  }, [parsedData.startDate]);

  const endDate = useMemo(() => {
    // First check if the data loaded from backend has an endDate
    if (parsedData.endDate && typeof parsedData.endDate === 'string') {
      return parsedData.endDate;
    }
    
    // If not, calculate based on start date and duration
    // Calculate end date based on duration and timeUnit
    const currentTimeUnit = (parsedData.timeUnit as TimeUnit) || 'days';
    const durationValue = Number(duration.value) || 30;
    
    // Convert to days based on time unit
    const durationDays = convertToDays(durationValue, currentTimeUnit);
    
    // Calculate end date from start date if available, otherwise use current date
    const startDateObj = parsedData.startDate ? new Date(parsedData.startDate) : new Date();
    const endDateObj = calculateEndDate(startDateObj, durationDays);
    return format(endDateObj, 'yyyy-MM-dd');
  }, [parsedData.endDate, parsedData.startDate, parsedData.timeUnit, duration.value]);

  // Add date change handlers
  const handleStartDateChange = useCallback((date: string) => {
    // Update local state first (add this if needed)
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, startDate: date });
    
    // Clear existing timeout 
    if (startDateRef.current) clearTimeout(startDateRef.current);
    
    // Debounce the save to backend
    startDateRef.current = setTimeout(() => {
      // Update the persistence ref to avoid cycling
      datesPersistenceRef.current.startDate = date || null;
      
      saveToBackend({ startDate: date });
      
      // Publish the update to subscribers using the manifest system
      safePublishUpdate(
        { ...parsedData, startDate: date },
        ['startDate'],
        { updateType: NodeUpdateType.CONTENT }
      );
      
      startDateRef.current = null;
    }, 500);
  }, [id, parsedData, updateNodeData, saveToBackend, safePublishUpdate]);

  const handleEndDateChange = useCallback((date: string) => {
    // Update local state first (add this if needed)
    
    // Then update ReactFlow state
    updateNodeData(id, { ...parsedData, endDate: date });
    
    // Clear existing timeout
    if (endDateRef.current) clearTimeout(endDateRef.current);
    
    // Debounce the save to backend
    endDateRef.current = setTimeout(() => {
      // Update the persistence ref to avoid cycling
      datesPersistenceRef.current.endDate = date || null;
      
      saveToBackend({ endDate: date });
      
      // Publish the update to subscribers using the manifest system
      safePublishUpdate(
        { ...parsedData, endDate: date },
        ['endDate'],
        { updateType: NodeUpdateType.CONTENT }
      );
      
      endDateRef.current = null;
    }, 500);
  }, [id, parsedData, updateNodeData, saveToBackend, safePublishUpdate]);

  // Update member names in team allocations when member nodes change
  useEffect(() => {
    const nodes = getNodes();
    let hasUpdates = false;
    
    // Create updated team allocations
    const updatedTeamAllocations = processedTeamAllocations.map((teamAllocation: TeamAllocation) => {
      const updatedMembers = teamAllocation.allocatedMembers.map(member => {
        // Find the member node
        const memberNode = nodes.find(n => n.id === member.memberId && isMemberNode(n));
        if (!memberNode || memberNode.data.title === member.name) {
          return member;
        }
        
        // Update member name if it has changed
        hasUpdates = true;
        return {
          ...member,
          name: memberNode.data.title
        };
      });
      
      return {
        ...teamAllocation,
        allocatedMembers: updatedMembers
      };
    });
    
    // Only update if names have changed
    if (hasUpdates) {
      updateNodeData(id, {
        ...parsedData,
        teamAllocations: updatedTeamAllocations
      });
    }
  }, [id, parsedData, getNodes, updateNodeData, processedTeamAllocations]);

  // Handle node data updates from other nodes
  useEffect(() => {
    if (!id) return;

    // Subscribe to updates based on the node manifest
    const { unsubscribe } = subscribeBasedOnManifest();

    // Handle node data updates
    const handleNodeDataUpdated = (event: NodeDataEvent) => {
      const { publisherType, relevantFields, publisherId } = event.detail;

      // Use the standardized shouldProcessUpdate functions
      if (!durationPublishing.shouldProcessUpdate(publisherId, relevantFields) || 
          !resourceAllocation.shouldProcessUpdate(publisherId, relevantFields)) {
        return;
      }

      console.log(`[FeatureNode][${id}] Processing update from ${publisherType} ${publisherId}:`, relevantFields);

      switch (publisherType) {
        case 'team':
          // Handle team updates that might affect this feature
          if (relevantFields.includes('roster') || relevantFields.includes('bandwidth')) {
            // Refresh team data to get updated allocations
            refreshConnectedTeamData();
          }
          break;

        case 'provider':
          // Handle provider updates that might affect this feature
          if (relevantFields.includes('costs') || relevantFields.includes('duration')) {
            // Refresh provider data to get updated costs
            refreshConnectedTeamData();
          }
          break;
      }
    };

    window.addEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);

    return () => {
      unsubscribe();
      window.removeEventListener('nodeDataUpdated', handleNodeDataUpdated as EventListener);
    };
  }, [id, subscribeBasedOnManifest, refreshConnectedTeamData, durationPublishing, resourceAllocation]);

  // Return the hook API
  return useMemo(() => ({
    // State
    title,
    description,
    buildType,
    status,
    processedTeamAllocations: teamAllocationHook.processedTeamAllocations,
    connectedTeams: teamAllocationHook.connectedTeams,
    startDate,
    endDate,
    isLoading,
    
    // Event handlers
    handleTitleChange,
    handleTitleCommit: handleTitleChange,
    handleDescriptionChange,
    handleDescriptionCommit: handleDescriptionChange,
    handleBuildTypeChange,
    handleStatusChange: cycleStatus,
    cycleStatus,
    handleTimeUnitChange,
    handleStartDateChange,
    handleEndDateChange,
    handleDelete,
    requestTeamAllocation,
    handleDurationChange: handleDurationChangeWithPublish,
    
    // Resource allocation
    handleAllocationChangeLocal: resourceAllocation.handleAllocationChangeLocal,
    handleAllocationCommit: resourceAllocation.handleAllocationCommit,
    calculateMemberAllocations: resourceAllocation.calculateMemberAllocations,
    calculateCostSummary: resourceAllocation.calculateCostSummary,
    
    // Duration management
    duration: {
      value: duration.value,
      displayValue: duration.displayValue,
      timeUnit: parsedData.timeUnit,
      handleDurationChange: handleDurationChangeWithPublish
    },
    
    // Utils
    getStatusColor,
    refreshData,
    refreshConnectedTeamData,
    costs,
    
    // Developer tools
    _debugId: id
  }), [
    id,
    title,
    description,
    buildType,
    status,
    teamAllocationHook.processedTeamAllocations,
    teamAllocationHook.connectedTeams,
    startDate,
    endDate,
    isLoading,
    handleTitleChange,
    handleDescriptionChange,
    handleBuildTypeChange,
    cycleStatus,
    handleDurationChangeWithPublish,
    handleTimeUnitChange,
    handleStartDateChange,
    handleEndDateChange,
    handleDelete,
    requestTeamAllocation,
    resourceAllocation,
    getStatusColor,
    refreshData,
    refreshConnectedTeamData,
    costs,
    duration.value,
    duration.displayValue,
    parsedData.timeUnit
  ]);
} 