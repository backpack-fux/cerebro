import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNodeConnections, useReactFlow } from '@xyflow/react';
import { CostSummaryComponent } from '@/components/allocation/CostSummary';
import { parseJsonIfString } from '@/utils/utils';
import { 
  isTeamNode, 
  isMemberNode,
  FeatureNodeData
} from '@/utils/type-guards';
import {
  TeamAllocation,
  MemberAllocation,
  WorkAllocation,
  AvailableMember,
  CostSummary,
} from '@/utils/types/allocation';
import { calculateMemberAllocationDetails } from '@/utils/allocation/weekly';
import { calculateCostSummary } from '@/utils/allocation/cost';
import { calculateNodeMemberCapacity } from '@/utils/allocation/node-capacity';
import {
  calculateCalendarDuration,
  getEndDateFromDuration
} from '@/utils/time/calendar';
import { useMemberAllocationPublishing, NodeDataWithTeamAllocations } from '@/hooks/useMemberAllocationPublishing';
import { NodeType } from '@/services/graph/neo4j/api-urls';

// Define our own RosterMember interface to match the actual usage in the code
interface TeamRosterMember {
  memberId: string;
  allocation: number;  // % of member's time allocated to team
  allocations?: Array<WorkAllocation>;
  startDate?: string;
  name?: string;
}

// Type cast function to handle RosterMember with allocations 
function asTeamRosterMember(member: unknown): TeamRosterMember {
  if (!member || typeof member !== 'object') {
    return { memberId: '', allocation: 0 };
  }
  return member as TeamRosterMember;
}

// Interface for connected teams returned by the hook
export interface ConnectedTeam {
  teamId: string;
  name: string;
  requestedHours: number;
  availableBandwidth: AvailableMember[];
}

/**
 * Hook for managing team allocations for feature nodes
 */
export function useTeamAllocation(nodeId: string, data: FeatureNodeData) {
  const { updateNodeData, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id: nodeId });
  
  // Determine the node type based on the data structure
  const nodeType = useMemo((): NodeType => {
    // Simple heuristic to determine node type
    if ('buildType' in data) return 'feature';
    if ('isDisruptive' in data) return 'option';
    if ('costs' in data) return 'provider';
    return 'feature'; // Default to feature if unknown
  }, [data]);
  
  // Use the standardized member allocation publishing hook
  const allocationPublishing = useMemberAllocationPublishing(
    nodeId,
    nodeType,
    data as NodeDataWithTeamAllocations,
    undefined, // No external publish function
    {
      fieldName: 'teamAllocations',
      debugName: `${nodeType}Node-TeamAllocation`
    }
  );
  
  // Refs for caching connected teams
  const prevConnectionsStringRef = useRef<string>('');
  const prevConnectedTeamsResultRef = useRef<ConnectedTeam[]>([]);
  
  // Refs for caching cost calculations
  const prevCostCacheKeyRef = useRef('');
  const prevCostResultRef = useRef<CostSummary>({
    dailyCost: 0,
    totalCost: 0,
    totalHours: 0,
    totalDays: 0,
    allocations: [],
  });

  // Ref to track node IDs that have already been confirmed to not exist
  const nonExistentNodeIdsRef = useRef<Set<string>>(new Set());

  // Parse team allocations from the node data
  const processedTeamAllocations = useMemo(() => {
    return parseJsonIfString<TeamAllocation[]>(data.teamAllocations, []);
  }, [data.teamAllocations]);

  // Effect to handle blocking specific node requests that repeatedly fail
  useEffect(() => {
    // Look for any non-existent node IDs from connection data and add to our blocklist
    const potentialNodeIds = connections.map(c => [c.source, c.target]).flat();
    
    // We have seen from logs that this specific node is causing 404 errors
    const knownBadNodeId = '95c72037-da89-4bfe-af8f-ea847cbdbe87';
    if (potentialNodeIds.includes(knownBadNodeId) && !nonExistentNodeIdsRef.current.has(knownBadNodeId)) {
      nonExistentNodeIdsRef.current.add(knownBadNodeId);
    }
  }, [connections]);

  // Get connected teams
  const connectedTeams = useMemo(() => {
    // Use the cached result if connections haven't changed
    const connectionsString = JSON.stringify(connections);
    if (connectionsString === prevConnectionsStringRef.current) {
      return prevConnectedTeamsResultRef.current;
    }
    
    // Update the cache
    prevConnectionsStringRef.current = connectionsString;
    
    // Get all nodes
    const nodes = getNodes();
    
    // Filter for team nodes that are connected to this feature
    const teamNodes = connections
      .filter(c => {
        const sourceNode = nodes.find(n => n.id === c.source);
        return sourceNode && sourceNode.type === 'team';
      })
      .map(c => {
        const teamNode = nodes.find(n => n.id === c.source);
        if (!teamNode) return null;
        
        // Find the team allocation for this team
        const teamAllocation = processedTeamAllocations.find(a => a.teamId === teamNode.id);
        
        // Process the team's roster if available
        let availableBandwidth: AvailableMember[] = [];
        
        // Check if the team node has a roster
        if (teamNode.data.roster) {
          try {
            // Parse the roster if it's a string
            const roster = parseJsonIfString<TeamRosterMember[]>(teamNode.data.roster, []);
            
            // Map the roster to available members
            availableBandwidth = roster.map((member: TeamRosterMember) => {
              // Find the actual team member node to get the correct name and capacity
              const memberNode = nodes.find(n => n.id === member.memberId);
              const memberName = memberNode?.data?.title || 
                (typeof member.name === 'string' ? member.name : '') || 
                member.memberId.split('-')[0];
              
              // Get the actual capacity values from the team member node
              const hoursPerDay = Number(memberNode?.data?.hoursPerDay) || 8;
              const daysPerWeek = Number(memberNode?.data?.daysPerWeek) || 5;
              const weeklyCapacity = Number(memberNode?.data?.weeklyCapacity) || (hoursPerDay * daysPerWeek);
              
              // DEBUG: Log the capacity values
              console.log(`[useTeamAllocation] Capacity values for ${memberName}:`, {
                memberId: member.memberId,
                hoursPerDay,
                daysPerWeek,
                calculatedWeeklyCapacity: hoursPerDay * daysPerWeek,
                nodeWeeklyCapacity: Number(memberNode?.data?.weeklyCapacity),
                finalWeeklyCapacity: weeklyCapacity
              });
              
              // Calculate available hours based on allocation percentage and weekly capacity
              const teamAllocationPercentage = Number(member.allocation) || 0;
              
              // Use the shared utility function to calculate effective capacity
              const availableHours = calculateNodeMemberCapacity({
                memberId: member.memberId,
                name: memberName as string,
                weeklyCapacity,
                hoursPerDay,
                daysPerWeek,
                allocation: teamAllocationPercentage,
                availableHours: 0, // This will be calculated by the function
                dailyRate: Number(memberNode?.data?.dailyRate) || 350
              }, 5); // Default to 5 days for weekly capacity
              
              // The field is named dailyRate but it actually contains hourly rate directly
              const hourlyRate = Number(memberNode?.data?.dailyRate) || 350;
              
              return {
                memberId: member.memberId,
                name: memberName as string,
                availableHours,
                dailyRate: hourlyRate, // Field named incorrectly, but contains hourly rate
                hoursPerDay,
                daysPerWeek,
                weeklyCapacity,
                allocation: teamAllocationPercentage,
                hourlyRate // Add to ensure the correct rate is available for calculations
              } as AvailableMember;
            });
          } catch {
            // Error handled silently, returns empty array
          }
        }
        
        return {
          teamId: teamNode.id,
          name: String(teamNode.data.title || teamNode.data.name || 'Unnamed Team'),
          requestedHours: teamAllocation?.requestedHours || 0,
          availableBandwidth
        } as ConnectedTeam;
      })
      .filter(Boolean) as ConnectedTeam[];
    
    // Cache the result
    prevConnectedTeamsResultRef.current = teamNodes;
    
    return teamNodes;
  }, [connections, getNodes, processedTeamAllocations]);

  // Save team allocations to backend with circular update protection
  const saveTeamAllocationsToBackend = useCallback((allocations: TeamAllocation[]) => {
    // Use the standardized publishing hook to handle saving
    return allocationPublishing.saveToBackendAsync(allocations);
  }, [allocationPublishing]);
  
  // Request team allocation
  const requestTeamAllocation = useCallback((
    teamId: string, 
    requestedHours: number, 
    memberData: string[] | Array<{ memberId: string; name?: string; hours?: number }> = [],
    saveToBackend: boolean = true
  ) => {
    // Enhanced logging to track usage
    console.log(`[TeamAllocation][${nodeId}] 🔍 requestTeamAllocation called with:`, {
      teamId,
      requestedHours,
      memberDataLength: Array.isArray(memberData) ? memberData.length : 0,
      memberDataType: typeof memberData,
      memberDataIsArray: Array.isArray(memberData),
      saveToBackend,
      currentNodeType: data.type || 'unknown',
      isUpdating: allocationPublishing.isUpdating.current
    });

    // Skip if we're in the middle of an update cycle already
    if (allocationPublishing.isUpdating.current) {
      console.log(`[TeamAllocation][${nodeId}] ⚠️ Skipping allocation request - already updating`);
      return;
    }
    
    if (!teamId) {
      console.error('[TeamAllocation] Missing teamId in requestTeamAllocation');
      return;
    }

    if (typeof requestedHours !== 'number') {
      console.error('[TeamAllocation] Invalid requestedHours in requestTeamAllocation:', requestedHours);
      return;
    }
    
    // Check if update is too recent to prevent circular updates
    if (allocationPublishing.isUpdateTooRecent(`request_${teamId}`)) {
      console.log(`[TeamAllocation][${nodeId}] ⚠️ Update too recent for team ${teamId}, skipping`);
      return;
    }
    
    // Get the current team allocations
    const currentAllocations = processedTeamAllocations;
    
    // Find the existing allocation for this team
    const existingAllocationIndex = currentAllocations.findIndex((a: TeamAllocation) => a.teamId === teamId);
    
    // Get the team node to access its roster
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!teamNode) {
      console.error('[TeamAllocation] Team node not found:', teamId);
      return;
    }
    
    // Get the team's roster
    const roster = parseJsonIfString<TeamRosterMember[]>(teamNode.data.roster, []);
    
    // Start with existing allocated members if updating an existing allocation
    const allocatedMembers: Array<{ memberId: string; name?: string; hours: number }> = 
      existingAllocationIndex >= 0 
        ? [...currentAllocations[existingAllocationIndex].allocatedMembers]
        : [];
    
    // Process member data
    if (Array.isArray(memberData)) {
      memberData.forEach(member => {
        if (typeof member === 'string') {
          // Find the member in the roster
          const rosterMember = roster.find(r => r.memberId === member);
          if (!rosterMember) return;
          
          // Calculate hours based on allocation percentage
          const memberAllocation = rosterMember.allocation || 0;
          const hours = (memberAllocation / 100) * requestedHours;
          
          // Find if this member is already in allocatedMembers
          const existingMemberIndex = allocatedMembers.findIndex(m => m.memberId === member);
          if (existingMemberIndex >= 0) {
            // Update existing member
            allocatedMembers[existingMemberIndex].hours = hours;
          } else {
            // Add new member
            allocatedMembers.push({
              memberId: member,
              hours
            });
          }
        } else {
          // Member is an object with memberId, name, and hours
          const { memberId, name, hours = 0 } = member;
          
          if (!memberId) {
            console.error('[TeamAllocation] Missing memberId in member data:', member);
            return;
          }
          
          // Find if this member is already in allocatedMembers
          const existingMemberIndex = allocatedMembers.findIndex(m => m.memberId === memberId);
          if (existingMemberIndex >= 0) {
            // Update existing member
            allocatedMembers[existingMemberIndex] = {
              ...allocatedMembers[existingMemberIndex],
              name: name || allocatedMembers[existingMemberIndex].name,
              hours: hours || 0
            };
          } else {
            // Add new member
            allocatedMembers.push({
              memberId,
              name: name || '',
              hours: hours || 0
            });
          }
        }
      });
    }
    
    // Calculate total requested hours from allocated members
    const totalRequestedHours = allocatedMembers.reduce((sum, member) => sum + member.hours, 0);
    
    // Create or update the team allocation with only the required fields
    const newAllocations = [...currentAllocations];
    if (existingAllocationIndex >= 0) {
      // Update existing allocation
      newAllocations[existingAllocationIndex] = {
        teamId,
        requestedHours: totalRequestedHours,
        allocatedMembers
      };
    } else {
      // Create new allocation
      newAllocations.push({
        teamId,
        requestedHours: totalRequestedHours,
        allocatedMembers
      });
    }
    
    // Set updating flag to prevent circular updates
    allocationPublishing.isUpdating.current = true;
    
    // Update the node data first to maintain UI state
    updateNodeData(nodeId, {
      ...data,
      teamAllocations: newAllocations
    });
    
    // Save to backend if requested, with proper Promise handling
    if (saveToBackend) {
      console.log(`[TeamAllocation][${nodeId}] 📤 SAVING TO BACKEND via saveTeamAllocationsToBackend`, {
        allocationsCount: newAllocations.length
      });
      
      saveTeamAllocationsToBackend(newAllocations)
        .then(success => {
          console.log(`[TeamAllocation][${nodeId}] ${success ? '✅ Successfully saved' : '❌ Failed to save'} allocations to backend`);
        })
        .catch(error => {
          console.error(`[TeamAllocation][${nodeId}] 🚨 Error saving allocations:`, error);
        })
        .finally(() => {
          // Reset updating flag after a delay regardless of success/failure
          setTimeout(() => {
            allocationPublishing.isUpdating.current = false;
            console.log(`[TeamAllocation][${nodeId}] 🔄 Reset updating flag after team allocation request`);
          }, 300);
        });
    } else {
      console.log(`[TeamAllocation][${nodeId}] ℹ️ saveToBackend=false, skipping backend save`);
      // If not saving to backend, still reset the updating flag after a delay
      setTimeout(() => {
        allocationPublishing.isUpdating.current = false;
      }, 300);
    }
    
    // Return the updated allocations
    return newAllocations;
  }, [data, getNodes, nodeId, updateNodeData, processedTeamAllocations, saveTeamAllocationsToBackend, allocationPublishing]);

  // Remove member allocation
  const removeMemberAllocation = useCallback((
    teamId: string,
    memberId: string
  ) => {
    // Skip if we're in the middle of an update cycle
    if (allocationPublishing.isUpdating.current) {
      console.log(`[TeamAllocation] Skipping member allocation removal - already updating`);
      return;
    }

    // Check if update is too recent to prevent circular updates
    if (allocationPublishing.isUpdateTooRecent(`remove_${teamId}_${memberId}`)) {
      return;
    }

    // Get the team node
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!isTeamNode(teamNode)) return;

    // Get the member node
    const memberNode = getNodes().find(n => n.id === memberId);
    if (!isMemberNode(memberNode)) return;

    // Set updating flag to prevent circular updates
    allocationPublishing.isUpdating.current = true;

    // Update the team roster to remove this allocation
    const updatedRoster = teamNode.data.roster.map(member => {
      if (member.memberId !== memberId) return member;

      // Safely access allocations, defaulting to empty array if not present
      const memberWithAllocations = asTeamRosterMember(member);
      const memberAllocations = memberWithAllocations.allocations || [];
      
      // Remove the allocation for this node
      const updatedAllocations = memberAllocations.filter((a: WorkAllocation) => a.nodeId !== nodeId);
      
      // Recalculate total utilization
      const totalUtilization = updatedAllocations.reduce((sum: number, allocation: WorkAllocation) => 
        sum + allocation.percentage, 0);

      return {
        ...member,
        allocation: Math.min(100, totalUtilization),
        allocations: updatedAllocations
      };
    });

    // Update the team node
    updateNodeData(teamId, {
      ...teamNode.data,
      roster: updatedRoster,
      _lastUpdate: Date.now()
    });

    // Log the update for debugging
    console.log(`[TeamAllocation] Removed allocation for team ${teamId}, member ${memberId}:`, {
      nodeId,
      updatedRoster
    });

    // Use the utility function to ensure teamAllocations is an array
    const teamAllocationsArray = processedTeamAllocations;

    // Find the team allocation
    const teamAllocation = teamAllocationsArray.find((a: TeamAllocation) => a.teamId === teamId);
    if (!teamAllocation) return;

    // Remove the member from the allocation
    const updatedMembers = teamAllocation.allocatedMembers.filter((m: MemberAllocation) => m.memberId !== memberId);
    
    // Calculate new total requested hours
    const totalRequestedHours = updatedMembers.reduce((sum: number, m: MemberAllocation) => sum + m.hours, 0);

    // Update the team allocations
    const updatedTeamAllocations = teamAllocationsArray.map((a: TeamAllocation) => {
      if (a.teamId !== teamId) return a;
      
      return {
        ...a,
        requestedHours: totalRequestedHours,
        allocatedMembers: updatedMembers
      };
    });

    // Update the node data FIRST, before saving to backend
    updateNodeData(nodeId, {
      ...data,
      teamAllocations: updatedTeamAllocations
    });
    
    // THEN save to backend with proper Promise handling
    saveTeamAllocationsToBackend(updatedTeamAllocations)
      .finally(() => {
        // Reset updating flag after a delay regardless of success/failure
        setTimeout(() => {
          allocationPublishing.isUpdating.current = false;
          console.log(`[TeamAllocation] Reset updating flag after removal`);
        }, 300);
      });
  }, [nodeId, data, getNodes, updateNodeData, processedTeamAllocations, saveTeamAllocationsToBackend, allocationPublishing]);

  // Update member allocation
  const updateMemberAllocation = useCallback((
    teamId: string,
    memberId: string,
    hours: number,
    startDate?: string,
    endDate?: string
  ) => {
    // Skip if we're in the middle of an update cycle
    if (allocationPublishing.isUpdating.current) {
      console.log(`[TeamAllocation] Skipping member allocation update - already updating`);
      return;
    }

    // Check if update is too recent to prevent circular updates
    if (allocationPublishing.isUpdateTooRecent(`update_${teamId}_${memberId}`)) {
      return;
    }

    // Validate inputs
    if (!teamId || !memberId || typeof hours !== 'number') {
      console.error('[TeamAllocation] Invalid inputs to updateMemberAllocation:', { teamId, memberId, hours });
      return;
    }

    // Get the team node
    const teamNode = getNodes().find(n => n.id === teamId);
    if (!isTeamNode(teamNode)) {
      console.error('[TeamAllocation] Team node not found or invalid:', teamId);
      return;
    }

    // Get the member node
    const memberNode = getNodes().find(n => n.id === memberId);
    if (!isMemberNode(memberNode)) {
      console.error('[TeamAllocation] Member node not found or invalid:', memberId);
      return;
    }

    // Set updating flag to prevent circular updates
    allocationPublishing.isUpdating.current = true;

    // Use feature dates or calculate reasonable defaults
    const featureStartDate = startDate || data.startDate || new Date().toISOString().split('T')[0];
    const featureDuration = data.duration || 10; // Default to 10 days if not specified
    
    // Calculate end date if not provided
    const featureEndDate = endDate || data.endDate || getEndDateFromDuration(
      featureStartDate, 
      featureDuration, 
      memberNode.data.daysPerWeek
    );

    // Calculate allocation details
    const allocationDetails = calculateMemberAllocationDetails(
      featureStartDate,
      featureEndDate,
      featureDuration,
      {
        hoursPerDay: memberNode.data.hoursPerDay, 
        daysPerWeek: memberNode.data.daysPerWeek,
        dailyRate: memberNode.data.dailyRate || 350
      },
      hours
    );

    // Update the team roster for this member
    const updatedRoster = teamNode.data.roster.map(member => {
      if (member.memberId !== memberId) return member;

      // Cast to our extended type
      const memberWithAllocations = asTeamRosterMember(member);
      const memberAllocations = memberWithAllocations.allocations || [];

      // Find existing allocation for this node
      const existingAllocationIndex = memberAllocations.findIndex((a: WorkAllocation) => a.nodeId === nodeId);
      
      let updatedAllocations: WorkAllocation[];
      if (existingAllocationIndex >= 0) {
        // Update existing allocation
        updatedAllocations = [...memberAllocations];
        updatedAllocations[existingAllocationIndex] = {
          nodeId,
          percentage: allocationDetails.percentage,
          startDate: allocationDetails.startDate,
          endDate: allocationDetails.endDate,
          totalHours: hours
        };
      } else {
        // Add new allocation
        updatedAllocations = [
          ...memberAllocations,
          {
            nodeId,
            percentage: allocationDetails.percentage,
            startDate: allocationDetails.startDate,
            endDate: allocationDetails.endDate,
            totalHours: hours
          }
        ];
      }

      // Calculate total utilization from all work nodes
      const totalUtilization = updatedAllocations.reduce((sum: number, allocation: WorkAllocation) => 
        sum + allocation.percentage, 0);

      return {
        ...member,
        allocation: Math.min(100, totalUtilization),
        allocations: updatedAllocations
      };
    });

    // Update the team node
    updateNodeData(teamId, {
      ...teamNode.data,
      roster: updatedRoster,
      _lastUpdate: Date.now()
    });

    // Log the update for debugging
    console.log(`[TeamAllocation] Updated team ${teamId} roster for member ${memberId}:`, {
      nodeId,
      hours,
      percentage: allocationDetails.percentage,
      updatedRoster
    });

    // Get the current team allocations array
    const teamAllocationsArray = processedTeamAllocations;

    // Find the team allocation
    const teamAllocationIndex = teamAllocationsArray.findIndex((a: TeamAllocation) => a.teamId === teamId);
    
    if (teamAllocationIndex >= 0) {
      // Create updated member allocation with only the required fields
      const updatedMemberAllocation: MemberAllocation = {
        memberId,
        name: memberNode.data.title || '',
        hours
      };

      // Update or add the member allocation
      const existingTeamAllocation = teamAllocationsArray[teamAllocationIndex];
      const memberIndex = existingTeamAllocation.allocatedMembers.findIndex(
        (m: MemberAllocation) => m.memberId === memberId
      );
      
      let updatedMembers: MemberAllocation[];
      if (memberIndex >= 0) {
        // Update existing member
        updatedMembers = [...existingTeamAllocation.allocatedMembers];
        updatedMembers[memberIndex] = updatedMemberAllocation;
      } else {
        // Add new member
        updatedMembers = [...existingTeamAllocation.allocatedMembers, updatedMemberAllocation];
      }
      
      // Calculate new total requested hours
      const totalRequestedHours = updatedMembers.reduce(
        (sum: number, m: MemberAllocation) => sum + (m.hours || 0), 
        0
      );
      
      // Create the updated team allocations object
      const updatedTeamAllocations = teamAllocationsArray.map((a: TeamAllocation) => {
        if (a.teamId !== teamId) return a;
        
        return {
          teamId: a.teamId,
          requestedHours: totalRequestedHours,
          allocatedMembers: updatedMembers
        };
      });
      
      // Update the node data FIRST, before saving to backend
      // This ensures the UI stays in sync with user actions
      updateNodeData(nodeId, {
        ...data,
        teamAllocations: updatedTeamAllocations
      });

      // THEN save to backend, allowing the saveTeamAllocationsToBackend function
      // to handle its own UI updates as needed for the specific node
      saveTeamAllocationsToBackend(updatedTeamAllocations)
        .finally(() => {
          // Reset updating flag after a delay regardless of success/failure
          setTimeout(() => {
            allocationPublishing.isUpdating.current = false;
            console.log(`[TeamAllocation] Reset updating flag after save`);
          }, 300);
        });
    } else {
      // Create new team allocation with this member, using only the required fields
      const newTeamAllocation = {
        teamId,
        requestedHours: hours,
        allocatedMembers: [{
          memberId,
          name: memberNode.data.title || '',
          hours
        }]
      };
      
      // Create a new array with the new allocation
      const updatedTeamAllocations = [...teamAllocationsArray, newTeamAllocation];
      
      // Update the node data FIRST, before saving to backend
      updateNodeData(nodeId, {
        ...data,
        teamAllocations: updatedTeamAllocations
      });

      // THEN save to backend with proper Promise handling
      saveTeamAllocationsToBackend(updatedTeamAllocations)
        .finally(() => {
          // Reset updating flag after a delay regardless of success/failure
          setTimeout(() => {
            allocationPublishing.isUpdating.current = false;
            console.log(`[TeamAllocation] Reset updating flag after save`);
          }, 300);
        });
    }
  }, [nodeId, data, getNodes, updateNodeData, processedTeamAllocations, saveTeamAllocationsToBackend, allocationPublishing]);

  // Calculate costs based on team allocations
  const costs = useMemo(() => {
    // Add caching to prevent unnecessary recalculations
    const teamAllocationsString = JSON.stringify(processedTeamAllocations);
    const connectedTeamsString = JSON.stringify(connectedTeams.map(t => t.teamId));
    const cacheKey = `${teamAllocationsString}-${connectedTeamsString}`;
    
    // Return cached result if inputs haven't changed
    if (cacheKey === prevCostCacheKeyRef.current) {
      return prevCostResultRef.current;
    }
    
    // Create a map of available members for faster lookup
    const availableMembersMap: Record<string, AvailableMember> = {};
    connectedTeams.forEach(team => {
      team.availableBandwidth.forEach(member => {
        availableMembersMap[member.memberId] = member;
      });
    });
    
    // Calculate cost summary using the utility function
    const costSummary = calculateCostSummary(processedTeamAllocations, availableMembersMap);
    
    // Add calendar duration if we have allocations with dates
    const allocationsWithDates = costSummary.allocations.filter(a => a.startDate && a.endDate);
    if (allocationsWithDates.length > 0) {
      const startDate = allocationsWithDates.reduce((earliest, curr) => 
        curr.startDate! < earliest ? curr.startDate! : earliest, 
        allocationsWithDates[0].startDate!
      );
      const endDate = allocationsWithDates.reduce((latest, curr) => 
        curr.endDate! > latest ? curr.endDate! : latest, 
        allocationsWithDates[0].endDate!
      );
      costSummary.calendarDuration = calculateCalendarDuration(startDate, endDate);
    }
    
    // Update cache
    prevCostCacheKeyRef.current = cacheKey;
    prevCostResultRef.current = costSummary;
    
    return costSummary;
  }, [processedTeamAllocations, connectedTeams]);

  // Return the hook API
  return {
    connectedTeams,
    processedTeamAllocations,
    requestTeamAllocation,
    saveTeamAllocationsToBackend,
    removeMemberAllocation,
    updateMemberAllocation,
    costs,
    CostSummary: CostSummaryComponent,
    // Add standardized protection against circular updates
    shouldProcessUpdate: allocationPublishing.shouldProcessUpdate
  };
} 