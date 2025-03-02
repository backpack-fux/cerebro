"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useReactFlow, useEdges } from "@xyflow/react";
import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamAllocation } from "@/hooks/useTeamAllocation";
import { useDurationInput } from "@/hooks/useDurationInput";
import { Slider } from "@/components/ui/slider";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { 
  RFProviderNodeData, 
  ProviderCost, 
  DDItem, 
  CostType, 
  FixedCost, 
  UnitCost, 
  RevenueCost, 
  TieredCost, 
  DDStatus,
  TierRange,
  TeamAllocation
} from '@/services/graph/provider/provider.types';
import { API_URLS } from '@/services/graph/neo4j/api-urls';
import { toast } from "sonner";
import { parseTeamAllocations } from '@/lib/utils';

export function ProviderNode({ id, data, selected }: NodeProps) {
  // Add a very visible debug log
  console.log('🔍 PROVIDER NODE RENDERING:', { id, data, teamAllocations: data.teamAllocations });
  
  // Cast data to the correct type for internal use
  const typedData = data as RFProviderNodeData;
  
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  
  // Ensure teamAllocations is always an array for UI rendering
  const processedTeamAllocations = useMemo(() => {
    if (Array.isArray(typedData.teamAllocations)) {
      return typedData.teamAllocations;
    } else if (typeof typedData.teamAllocations === 'string') {
      try {
        const parsed = JSON.parse(typedData.teamAllocations);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse teamAllocations string:', e);
      }
    }
    return [];
  }, [typedData.teamAllocations]);
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const costsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const ddItemsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const durationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const teamAllocationsDebounceRef = useRef<{ timeout: NodeJS.Timeout | null }>({ timeout: null });
  
  // Track render count to debug refresh issues
  const renderCountRef = useRef(0);
  useEffect(() => {
    renderCountRef.current += 1;
    console.log(`🔄 ProviderNode render #${renderCountRef.current} for node ${id}`, {
      teamAllocations: processedTeamAllocations,
      teamAllocationsType: typeof processedTeamAllocations,
      isArray: Array.isArray(processedTeamAllocations),
      hasTeamAllocations: processedTeamAllocations && 
        (Array.isArray(processedTeamAllocations) ? processedTeamAllocations.length > 0 : true)
    });
  });
  
  // Ensure data structure is properly initialized
  useEffect(() => {
    console.log('🔍 Data structure initialization effect running', {
      id,
      costs: typedData.costs,
      costsType: typeof typedData.costs,
      ddItems: typedData.ddItems,
      ddItemsType: typeof typedData.ddItems,
      teamAllocations: processedTeamAllocations,
      teamAllocationsType: typeof processedTeamAllocations
    });
    
    const updates: Partial<RFProviderNodeData> = {};
    let needsUpdate = false;
    
    // Check if costs is not an array
    if (typedData.costs !== undefined && !Array.isArray(typedData.costs)) {
      console.warn('⚠️ Fixing costs data structure:', typedData.costs);
      updates.costs = [];
      needsUpdate = true;
    }
    
    // Check if ddItems is not an array
    if (typedData.ddItems !== undefined && !Array.isArray(typedData.ddItems)) {
      console.warn('⚠️ Fixing ddItems data structure:', typedData.ddItems);
      updates.ddItems = [];
      needsUpdate = true;
    }
    
    // Check if teamAllocations is not an array
    if (processedTeamAllocations !== undefined && !Array.isArray(processedTeamAllocations)) {
      console.warn('⚠️ Fixing teamAllocations data structure:', processedTeamAllocations);
      
      // If it's a string, try to parse it
      if (typeof processedTeamAllocations === 'string') {
        try {
          console.log('🔍 Attempting to parse teamAllocations string in ProviderNode:', processedTeamAllocations);
          const parsed = JSON.parse(processedTeamAllocations);
          if (Array.isArray(parsed)) {
            console.log('✅ Successfully parsed teamAllocations string to array in ProviderNode', {
              length: parsed.length,
              data: parsed
            });
            updates.teamAllocations = parsed;
          } else {
            console.warn('⚠️ Parsed teamAllocations is not an array in ProviderNode', {
              parsed,
              type: typeof parsed
            });
            updates.teamAllocations = [];
          }
        } catch (e) {
          console.warn('❌ Failed to parse teamAllocations string in ProviderNode', {
            error: e,
            teamAllocations: processedTeamAllocations
          });
          updates.teamAllocations = [];
        }
      } else {
        updates.teamAllocations = [];
      }
      
      needsUpdate = true;
    }
    
    // Update the node data if needed
    if (needsUpdate) {
      console.log('🔄 Updating node data with fixed structure', updates);
      updateNodeData(id, { ...typedData, ...updates });
    } else {
      console.log('✅ No data structure fixes needed');
    }
  }, [id, typedData, updateNodeData, processedTeamAllocations]);
  
  const {
    connectedTeams,
    requestTeamAllocation,
    removeMemberAllocation,
    updateMemberAllocation,
    costs,
    CostSummary
  } = useTeamAllocation(id, typedData);

  // Debug log to see what's happening with teamAllocations after refresh
  useEffect(() => {
    console.log('Provider Node Data after refresh:', {
      id,
      teamAllocations: processedTeamAllocations,
      teamAllocationsType: typeof processedTeamAllocations,
      isArray: Array.isArray(processedTeamAllocations),
      connectedTeams
    });
  }, [id, typedData, connectedTeams, processedTeamAllocations]);

  // Add an effect to ensure teamAllocations is always an array
  useEffect(() => {
    // If teamAllocations is undefined or null, initialize as empty array
    if (typedData.teamAllocations === undefined || typedData.teamAllocations === null) {
      console.log('🔄 Initializing teamAllocations as empty array');
      updateNodeData(id, { ...typedData, teamAllocations: [] });
      return;
    }
    
    // If teamAllocations is not an array, try to convert it
    if (!Array.isArray(typedData.teamAllocations)) {
      console.log('🔄 Converting teamAllocations to array:', typedData.teamAllocations);
      
      // If it's a string, try to parse it
      if (typeof typedData.teamAllocations === 'string') {
        try {
          const parsed = JSON.parse(typedData.teamAllocations);
          if (Array.isArray(parsed)) {
            console.log('✅ Successfully parsed teamAllocations string to array:', parsed);
            updateNodeData(id, { ...typedData, teamAllocations: parsed });
          } else {
            console.warn('⚠️ Parsed teamAllocations is not an array, using empty array instead');
            updateNodeData(id, { ...typedData, teamAllocations: [] });
          }
        } catch (e) {
          console.warn('❌ Failed to parse teamAllocations string, using empty array instead:', e);
          updateNodeData(id, { ...typedData, teamAllocations: [] });
        }
      } else {
        console.warn('⚠️ teamAllocations is not an array or string, using empty array instead');
        updateNodeData(id, { ...typedData, teamAllocations: [] });
      }
    }
  }, [id, typedData, updateNodeData]);

  const { status, getStatusColor, cycleStatus } = useNodeStatus(id, typedData, updateNodeData, {
    canBeActive: true,
    defaultStatus: 'planning'
  });

  // Helper function to calculate total allocation for a team member
  const calculateTotalAllocation = useCallback((memberId: string) => {
    // Find the member in the costs allocations
    const allocation = costs.allocations.find(a => a.member.memberId === memberId);
    return allocation ? allocation.allocation : 0;
  }, [costs.allocations]);

  // Save data to backend
  const saveToBackend = async (field: string, value: any) => {
    try {
      // Special handling for teamAllocations to ensure it's always an array
      if (field === 'teamAllocations' && value !== undefined) {
        // If it's already an array, use it as is
        if (Array.isArray(value)) {
          console.log(`Saving teamAllocations as array (${value.length} items)`, { value });
        } 
        // If it's a string, try to parse it
        else if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              value = parsed;
              console.log(`Parsed teamAllocations string to array (${value.length} items)`, { value });
            } else {
              console.warn('Parsed teamAllocations is not an array, using empty array instead', { parsed });
              value = [];
            }
          } catch (e) {
            console.warn('Failed to parse teamAllocations string, using empty array instead', { value, error: e });
            value = [];
          }
        } 
        // If it's neither an array nor a string, use an empty array
        else {
          console.warn('teamAllocations is neither an array nor a string, using empty array instead', { value, type: typeof value });
          value = [];
        }
        
        // Always update the node data with the array version before sending to backend
        // This ensures the UI always has the array version
        updateNodeData(id, { ...typedData, teamAllocations: value });
        
        // For Neo4j, we need to stringify the array
        console.log('Converting teamAllocations array to string for Neo4j', { 
          before: value,
          after: JSON.stringify(value)
        });
        value = JSON.stringify(value);
      }

      const response = await fetch(`${API_URLS['provider']}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update provider node: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Updated provider node ${id} ${field}`);
    } catch (error) {
      console.error(`Failed to update provider node ${id}:`, error);
      toast.error(`Update Failed: Failed to save ${field} to the server.`);
    }
  };

  // Save team allocations to backend with proper debouncing
  const saveTeamAllocationsToBackend = useCallback(async (teamAllocations: TeamAllocation[]) => {
    // Create a debounce ref if it doesn't exist yet
    if (!teamAllocationsDebounceRef.current) {
      teamAllocationsDebounceRef.current = { timeout: null };
    }
    
    // Clear any existing timeout
    if (teamAllocationsDebounceRef.current.timeout) {
      clearTimeout(teamAllocationsDebounceRef.current.timeout);
    }
    
    // Ensure teamAllocations is an array
    if (!Array.isArray(teamAllocations)) {
      console.warn('Cannot save teamAllocations: not an array', teamAllocations);
      return;
    }
    
    // Set a new debounce timer
    teamAllocationsDebounceRef.current.timeout = setTimeout(async () => {
      console.log('💾 Saving teamAllocations to backend:', teamAllocations);
      
      // Update the node data with the array version first
      updateNodeData(id, { ...typedData, teamAllocations });
      
      // Then save to backend
      await saveToBackend('teamAllocations', teamAllocations);
      
      // Clear the timeout reference
      teamAllocationsDebounceRef.current.timeout = null;
    }, 1000); // 1 second debounce
  }, [id, typedData, updateNodeData, saveToBackend]);

  // Save costs to backend
  const saveCostsToBackend = async (costs: ProviderCost[]) => {
    if (costsDebounceRef.current) clearTimeout(costsDebounceRef.current);
    
    // Ensure costs is an array before saving
    if (!Array.isArray(costs)) {
      console.warn('Cannot save costs: costs is not an array', costs);
      return;
    }
    
    costsDebounceRef.current = setTimeout(async () => {
      await saveToBackend('costs', costs);
      costsDebounceRef.current = null;
    }, 1000);
  };

  // Save DD items to backend
  const saveDDItemsToBackend = async (ddItems: DDItem[]) => {
    if (ddItemsDebounceRef.current) clearTimeout(ddItemsDebounceRef.current);
    
    // Ensure ddItems is an array before saving
    if (!Array.isArray(ddItems)) {
      console.warn('Cannot save ddItems: ddItems is not an array', ddItems);
      return;
    }
    
    ddItemsDebounceRef.current = setTimeout(async () => {
      await saveToBackend('ddItems', ddItems);
      ddItemsDebounceRef.current = null;
    }, 1000);
  };

  // Save duration to backend
  const saveDurationToBackend = async (duration: number) => {
    if (durationDebounceRef.current) clearTimeout(durationDebounceRef.current);
    
    durationDebounceRef.current = setTimeout(async () => {
      await saveToBackend('duration', duration);
      durationDebounceRef.current = null;
    }, 1000);
  };

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    updateNodeData(id, { ...typedData, title: newTitle });
    
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend('title', newTitle);
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, typedData, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    updateNodeData(id, { ...typedData, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      await saveToBackend('description', newDescription);
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, typedData, updateNodeData]);

  const handleDelete = useCallback(() => {
    // Delete the node from the backend
    fetch(`${API_URLS['provider']}/${id}`, { method: 'DELETE' })
      .then(() => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        
        // Also delete connected edges
        const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);
        connectedEdges.forEach((edge) => {
          fetch(`${API_URLS['provider']}/edges/${edge.id}`, { method: 'DELETE' })
            .catch((error) => console.error('Failed to delete edge:', error));
        });
      })
      .catch((error) => {
        console.error('Failed to delete provider node:', error);
        toast.error("Delete Failed: Failed to delete the provider node from the server.");
      });
  }, [id, setNodes, edges]);

  // Customize the duration input hook to save to backend
  const duration = useDurationInput(id, typedData, (nodeId, updatedData) => {
    updateNodeData(nodeId, updatedData);
    if (updatedData.duration !== typedData.duration) {
      saveDurationToBackend(updatedData.duration || 0);
    }
  }, {
    maxDays: 90,
    label: "Integration Duration",
    fieldName: "duration",
    tip: 'Estimated time to integrate with this provider'
  });

  // Handle allocation changes with backend saving
  const handleAllocationChange = useCallback((memberId: string, percentage: number) => {
    const teamId = connectedTeams.find(team => 
      team.availableBandwidth.some(m => m.memberId === memberId)
    )?.teamId;

    if (!teamId) return;

    // If percentage is 0, remove the allocation
    if (percentage === 0) {
      removeMemberAllocation(teamId, memberId);
      return;
    }

    // Calculate hours based on percentage
    const hoursRequested = (percentage / 100) * 8 * (typedData.duration || 1);
    
    // Use the utility function to ensure teamAllocations is an array
    const currentTeamAllocations = parseTeamAllocations(processedTeamAllocations);
    
    // Update the team allocations in the node data
    const updatedTeamAllocations: TeamAllocation[] = [...currentTeamAllocations];
    const existingAllocationIndex = updatedTeamAllocations.findIndex(a => a.teamId === teamId);
    
    if (existingAllocationIndex >= 0) {
      // Update existing allocation
      const existingAllocation = updatedTeamAllocations[existingAllocationIndex];
      const existingMemberIndex = existingAllocation.allocatedMembers.findIndex(m => m.memberId === memberId);
      
      if (existingMemberIndex >= 0) {
        // Update existing member allocation
        existingAllocation.allocatedMembers[existingMemberIndex].hours = hoursRequested;
      } else {
        // Add new member allocation
        existingAllocation.allocatedMembers.push({ memberId, hours: hoursRequested });
      }
      
      // Update total requested hours
      existingAllocation.requestedHours = existingAllocation.allocatedMembers.reduce(
        (total: number, member: { memberId: string; hours: number }) => total + member.hours, 0
      );
      
      updatedTeamAllocations[existingAllocationIndex] = existingAllocation;
    } else {
      // Create new allocation
      updatedTeamAllocations.push({
        teamId,
        requestedHours: hoursRequested,
        allocatedMembers: [{ memberId, hours: hoursRequested }]
      });
    }
    
    // Update the node data
    updateNodeData(id, { ...typedData, teamAllocations: updatedTeamAllocations });
    
    // Save to backend
    saveTeamAllocationsToBackend(updatedTeamAllocations);
    
    // Also call the hook function for UI updates
    updateMemberAllocation(teamId, memberId, hoursRequested);
  }, [connectedTeams, typedData, id, updateNodeData, saveTeamAllocationsToBackend, updateMemberAllocation, removeMemberAllocation, processedTeamAllocations]);

  const handleAddTeamMembers = useCallback((teamId: string, memberIds: string[], hours: number) => {
    if (!teamId || !memberIds.length) return;
    
    // Request team allocation for the selected members
    requestTeamAllocation(teamId, hours, memberIds);
  }, [requestTeamAllocation]);

  const addCost = useCallback(() => {
    const newCost: ProviderCost = {
      id: `cost-${Date.now()}`,
      name: '',
      costType: 'fixed',
      details: {
        type: 'fixed',
        amount: 0,
        frequency: 'monthly'
      }
    };
    
    // Ensure costs is an array before adding to it
    const currentCosts = Array.isArray(typedData.costs) ? typedData.costs : [];
    const updatedCosts = [...currentCosts, newCost];
    
    updateNodeData(id, { 
      ...typedData, 
      costs: updatedCosts
    });
    saveCostsToBackend(updatedCosts);
  }, [id, typedData, updateNodeData]);

  const updateCost = useCallback((costId: string, updates: Partial<ProviderCost>) => {
    // Ensure costs is an array before updating it
    if (!Array.isArray(typedData.costs)) {
      console.warn('Cannot update cost: costs is not an array', typedData.costs);
      return;
    }
    
    const updatedCosts = typedData.costs.map(cost => 
      cost.id === costId ? { ...cost, ...updates } : cost
    );
    
    updateNodeData(id, {
      ...typedData,
      costs: updatedCosts
    });
    saveCostsToBackend(updatedCosts);
  }, [id, typedData, updateNodeData]);

  const removeCost = useCallback((costId: string) => {
    // Ensure costs is an array before removing from it
    if (!Array.isArray(typedData.costs)) {
      console.warn('Cannot remove cost: costs is not an array', typedData.costs);
      return;
    }
    
    const updatedCosts = typedData.costs.filter(cost => cost.id !== costId);
    
    updateNodeData(id, {
      ...typedData,
      costs: updatedCosts
    });
    saveCostsToBackend(updatedCosts);
  }, [id, typedData, updateNodeData]);

  const addDDItem = useCallback(() => {
    const newItem: DDItem = {
      id: `dd-${Date.now()}`,
      name: '',
      status: 'pending'
    };
    
    // Ensure ddItems is an array before adding to it
    const currentItems = Array.isArray(typedData.ddItems) ? typedData.ddItems : [];
    const updatedItems = [...currentItems, newItem];
    
    updateNodeData(id, {
      ...typedData,
      ddItems: updatedItems
    });
    saveDDItemsToBackend(updatedItems);
  }, [id, typedData, updateNodeData]);

  const updateDDItem = useCallback((item: DDItem) => {
    // Ensure ddItems is an array before updating it
    if (!Array.isArray(typedData.ddItems)) {
      console.warn('Cannot update ddItem: ddItems is not an array', typedData.ddItems);
      return;
    }
    
    const updatedItems = typedData.ddItems.map(i => 
      i.id === item.id ? item : i
    );
    
    updateNodeData(id, {
      ...typedData,
      ddItems: updatedItems
    });
    saveDDItemsToBackend(updatedItems);
  }, [id, typedData, updateNodeData]);

  const removeDDItem = useCallback((itemId: string) => {
    // Ensure ddItems is an array before removing from it
    if (!Array.isArray(typedData.ddItems)) {
      console.warn('Cannot remove ddItem: ddItems is not an array', typedData.ddItems);
      return;
    }
    
    const updatedItems = typedData.ddItems.filter(i => i.id !== itemId);
    
    updateNodeData(id, {
      ...typedData,
      ddItems: updatedItems
    });
    saveDDItemsToBackend(updatedItems);
  }, [id, typedData, updateNodeData]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (costsDebounceRef.current) clearTimeout(costsDebounceRef.current);
      if (ddItemsDebounceRef.current) clearTimeout(ddItemsDebounceRef.current);
      if (durationDebounceRef.current) clearTimeout(durationDebounceRef.current);
      if (teamAllocationsDebounceRef.current?.timeout) clearTimeout(teamAllocationsDebounceRef.current.timeout);
    };
  }, []);

  return (
    <BaseNode selected={selected} className="w-[400px]">
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${getStatusColor(status)}`}
              onClick={cycleStatus}
            >
              {status}
            </Badge>
            <input
              value={typedData.title || 'Provider'}
              onChange={handleTitleChange}
              className="bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Provider name..."
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Provider node menu">
            <DropdownMenuItem onClick={handleDelete}>
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="p-4 space-y-4">
        <div>
          <Label htmlFor={`description-${id}`}>Description</Label>
          <Textarea
            id={`description-${id}`}
            value={typedData.description || ''}
            onChange={handleDescriptionChange}
            placeholder="Describe this provider..."
            className="mt-1 resize-none"
            rows={3}
          />
        </div>

        {/* Duration Input */}
        <div className="space-y-2">
          <Label>{duration.config.label}</Label>
          <div className="space-y-1">
            <div className="relative">
              <Input
                value={duration.value || ''}
                onChange={(e) => duration.handleDurationChange(e.target.value)}
                onKeyDown={duration.handleDurationKeyDown}
                className="bg-transparent pr-24"
                placeholder="e.g. 12 or 2w"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {duration.displayValue}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {duration.config.tip} Max {duration.formatDuration(duration.config.maxDays)}
            </p>
          </div>
        </div>

        {/* Team Allocation Section */}
        {connectedTeams.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Team Allocations</Label>
            </div>
            
            {connectedTeams.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Connect to teams to allocate resources
              </div>
            ) : (
              <div className="space-y-4">
                {connectedTeams.map(team => (
                  <div key={team.teamId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{team.title}</span>
                    </div>

                    {/* Member Allocation Controls */}
                    <div className="space-y-4">
                      {team.availableBandwidth.map(member => {
                        // Find if this member is already allocated
                        const allocation = costs.allocations.find(a => 
                          a.member.memberId === member.memberId
                        );
                        
                        const percentage = calculateTotalAllocation(member.memberId);
                        const availableHours = member.availableHours || 0;

                        return (
                          <div key={member.memberId} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{member.name}</span>
                              <span className="text-muted-foreground">
                                {percentage.toFixed(0)}% ({availableHours}h available)
                              </span>
                            </div>
                            <Slider
                              value={[percentage]}
                              onValueChange={([value]) => handleAllocationChange(member.memberId, value)}
                              max={100}
                              step={1}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cost Summary */}
            {costs.allocations.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <CostSummary costs={costs} duration={typedData.duration} />
              </div>
            )}
          </div>
        )}

        {/* Costs Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Cost Structures</Label>
            <Button variant="ghost" size="sm" onClick={addCost} className="h-6 px-2">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {Array.isArray(typedData.costs) 
              ? typedData.costs.map(cost => (
                <CostStructure
                  key={cost.id}
                  cost={cost}
                  onUpdate={(updates) => updateCost(cost.id, updates)}
                  onRemove={() => removeCost(cost.id)}
                />
              ))
              : null
            }
          </div>
        </div>

        {/* Due Diligence Section */}
        <DueDiligenceSection
          items={Array.isArray(typedData.ddItems) ? typedData.ddItems : []}
          onUpdate={updateDDItem}
          onAdd={addDDItem}
          onRemove={removeDDItem}
        />
      </div>

      <Handle type="target" position={Position.Bottom} id="target" />
      <Handle type="source" position={Position.Top} id="source" />
    </BaseNode>
  );
}

function CostStructure({ 
  cost, 
  onUpdate, 
  onRemove 
}: { 
  cost: ProviderCost;
  onUpdate: (updates: Partial<ProviderCost>) => void;
  onRemove: () => void;
}) {
  const handleTypeChange = (type: CostType) => {
    console.log('Changing cost type to:', type);
    const newDetails = {
      fixed: { type: 'fixed', amount: 0, frequency: 'monthly' },
      unit: { type: 'unit', unitPrice: 0, unitType: '' },
      revenue: { type: 'revenue', percentage: 0 },
      tiered: { type: 'tiered', unitType: '', tiers: [{ min: 0, unitPrice: 0 }] }
    }[type] as ProviderCost['details'];

    console.log('New cost details:', newDetails);
    onUpdate({ costType: type, details: newDetails });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <Input
            value={cost.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Cost name"
            className="bg-transparent"
          />
          <Select
            value={cost.costType}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger className="w-[180px] bg-transparent">
              <SelectValue placeholder="Select cost type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Cost</SelectItem>
              <SelectItem value="unit">Per Unit</SelectItem>
              <SelectItem value="revenue">Revenue Share</SelectItem>
              <SelectItem value="tiered">Tiered Pricing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 px-2"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      {/* Render different forms based on cost type */}
      {cost.costType === 'fixed' && (
        <FixedCostForm
          details={cost.details as FixedCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
      {cost.costType === 'unit' && (
        <UnitCostForm
          details={cost.details as UnitCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
      {cost.costType === 'revenue' && (
        <RevenueCostForm
          details={cost.details as RevenueCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
      {cost.costType === 'tiered' && (
        <TieredCostForm
          details={cost.details as TieredCost}
          onUpdate={(details) => onUpdate({ details })}
        />
      )}
    </div>
  );
}

// Individual cost type forms
function FixedCostForm({ 
  details, 
  onUpdate 
}: { 
  details: FixedCost;
  onUpdate: (details: FixedCost) => void;
}) {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    console.log('Updating fixed cost amount:', amount);
    onUpdate({ ...details, amount });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.amount}
              onChange={handleAmountChange}
              className="pl-7 bg-transparent"
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Frequency</Label>
          <Select
            value={details.frequency}
            onValueChange={(frequency) => onUpdate({ ...details, frequency: frequency as 'monthly' | 'annual' })}
          >
            <SelectTrigger className="w-[120px] bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function UnitCostForm({ 
  details, 
  onUpdate 
}: { 
  details: UnitCost;
  onUpdate: (details: UnitCost) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Unit Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.unitPrice}
              onChange={(e) => onUpdate({ ...details, unitPrice: parseFloat(e.target.value) || 0 })}
              className="pl-7 bg-transparent"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex-1">
          <Label className="text-xs">Unit Type</Label>
          <Input
            value={details.unitType}
            onChange={(e) => onUpdate({ ...details, unitType: e.target.value })}
            className="bg-transparent"
            placeholder="e.g., transaction, account"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Minimum Units (Optional)</Label>
          <Input
            type="number"
            value={details.minimumUnits || ''}
            onChange={(e) => onUpdate({ ...details, minimumUnits: parseFloat(e.target.value) || undefined })}
            className="bg-transparent"
            placeholder="No minimum"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Maximum Units (Optional)</Label>
          <Input
            type="number"
            value={details.maximumUnits || ''}
            onChange={(e) => onUpdate({ ...details, maximumUnits: parseFloat(e.target.value) || undefined })}
            className="bg-transparent"
            placeholder="No maximum"
          />
        </div>
      </div>
    </div>
  );
}

function RevenueCostForm({ 
  details, 
  onUpdate 
}: { 
  details: RevenueCost;
  onUpdate: (details: RevenueCost) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Revenue Percentage</Label>
          <div className="relative">
            <Input
              type="number"
              value={details.percentage}
              onChange={(e) => onUpdate({ ...details, percentage: parseFloat(e.target.value) || 0 })}
              className="pr-8 bg-transparent"
              placeholder="0.00"
              min={0}
              max={100}
              step={0.01}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>
        <div className="flex-1">
          <Label className="text-xs">Monthly Minimum (Optional)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.minimumMonthly || ''}
              onChange={(e) => onUpdate({ ...details, minimumMonthly: parseFloat(e.target.value) || undefined })}
              className="pl-7 bg-transparent"
              placeholder="No minimum"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TieredCostForm({ 
  details, 
  onUpdate 
}: { 
  details: TieredCost;
  onUpdate: (details: TieredCost) => void;
}) {
  const addTier = () => {
    const lastTier = details.tiers[details.tiers.length - 1];
    const newTier: TierRange = {
      min: lastTier.max || lastTier.min + 1,
      unitPrice: lastTier.unitPrice
    };
    onUpdate({
      ...details,
      tiers: [...details.tiers, newTier]
    });
  };

  const removeTier = (index: number) => {
    onUpdate({
      ...details,
      tiers: details.tiers.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Unit Type</Label>
          <Input
            value={details.unitType}
            onChange={(e) => onUpdate({ ...details, unitType: e.target.value })}
            className="bg-transparent"
            placeholder="e.g., transaction, account"
          />
        </div>
        <div>
          <Label className="text-xs">Monthly Minimum (Optional)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={details.minimumMonthly || ''}
              onChange={(e) => onUpdate({ ...details, minimumMonthly: parseFloat(e.target.value) || undefined })}
              className="pl-7 bg-transparent"
              placeholder="No minimum"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Pricing Tiers</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addTier}
            className="h-6 px-2"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {details.tiers.map((tier, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Min {details.unitType}s</Label>
              <Input
                type="number"
                value={tier.min}
                onChange={(e) => {
                  const newTiers = [...details.tiers];
                  newTiers[index] = { ...tier, min: parseFloat(e.target.value) || 0 };
                  onUpdate({ ...details, tiers: newTiers });
                }}
                className="bg-transparent"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Max {details.unitType}s (Optional)</Label>
              <Input
                type="number"
                value={tier.max || ''}
                onChange={(e) => {
                  const newTiers = [...details.tiers];
                  newTiers[index] = { ...tier, max: parseFloat(e.target.value) || undefined };
                  onUpdate({ ...details, tiers: newTiers });
                }}
                className="bg-transparent"
                placeholder="∞"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Price per Unit</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={tier.unitPrice}
                  onChange={(e) => {
                    const newTiers = [...details.tiers];
                    newTiers[index] = { ...tier, unitPrice: parseFloat(e.target.value) || 0 };
                    onUpdate({ ...details, tiers: newTiers });
                  }}
                  className="pl-7 bg-transparent"
                />
              </div>
            </div>
            {index > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTier(index)}
                className="h-10 px-2"
              >
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DueDiligenceSection({
  items,
  onUpdate,
  onAdd,
  onRemove
}: {
  items: DDItem[];
  onUpdate: (item: DDItem) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Due Diligence</Label>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onAdd}
          className="h-6 px-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <Input
                value={item.name}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                placeholder="DD item name"
                className="bg-transparent"
              />
              <Select
                value={item.status}
                onValueChange={(status) => onUpdate({ ...item, status: status as DDStatus })}
              >
                <SelectTrigger className="w-[130px] bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                className="h-6 px-2"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={item.notes}
              onChange={(e) => onUpdate({ ...item, notes: e.target.value })}
              placeholder="Additional notes..."
              className="min-h-[60px] text-sm bg-transparent"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => onUpdate({ ...item, dueDate: e.target.value })}
                  className="bg-transparent"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
