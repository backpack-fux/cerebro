"use client";

import { Handle, Position, type NodeProps, useReactFlow, useNodeConnections, useEdges, Node } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { RFTeamMemberNodeData } from "@/services/graph/team-member/team-member.types";
import { RFTeamNodeData, Season, RosterMember } from '@/services/graph/team/team.types';
import { GraphApiClient } from '@/services/graph/neo4j/api-client';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { Role } from '@/services/graph/shared/shared.types';
import { toast } from "sonner";

// Type guard for team member nodes
function isTeamMemberNode(node: any): node is { id: string, data: RFTeamMemberNodeData } {
  return Boolean(
    node?.type === 'teamMember' && 
    node.data && 
    typeof node.data.title === 'string' && 
    typeof node.data.weeklyCapacity === 'number'
  );
}

export function TeamNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, setNodes, getNodes, setEdges } = useReactFlow();
  const connections = useNodeConnections({ id });
  const edges = useEdges();
  
  // Cast data to the correct type
  const teamData = data as RFTeamNodeData;
  
  // Local state for title and description to avoid excessive API calls
  const [title, setTitle] = useState(teamData.title);
  const [description, setDescription] = useState(teamData.description || '');
  
  // Refs for debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const seasonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const rosterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ensure roster is always an array
  const roster = useMemo(() => {
    if (Array.isArray(teamData.roster)) {
      return teamData.roster;
    } else if (typeof teamData.roster === 'string') {
      try {
        return JSON.parse(teamData.roster);
      } catch (e) {
        console.warn('Failed to parse roster string:', e);
        return [];
      }
    }
    return [];
  }, [teamData.roster]);
  
  // Update local state when props change
  useEffect(() => {
    setTitle(teamData.title);
    setDescription(teamData.description || '');
  }, [teamData.title, teamData.description]);

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
    const rosterArray = Array.isArray(roster) ? roster : [];
    
    // Add new members to roster
    const currentMemberIds = new Set(rosterArray.map((m: RosterMember) => m.memberId));
    const newMembers = connectedMembers.filter(member => !currentMemberIds.has(member.memberId));

    if (newMembers.length > 0) {
      const updatedRoster = [...rosterArray, ...newMembers];
      updateNodeData(id, {
        ...teamData,
        roster: updatedRoster
      });
      
      // Save to backend
      saveRosterToBackend(updatedRoster);
    }
  }, [connections, teamData, id, updateNodeData, getNodes, roster]);

  // Initialize data with defaults
  const initialData = {
    ...teamData,
    roster
  };

  // Calculate season progress
  const seasonProgress = useMemo(() => {
    if (!teamData.season?.startDate || !teamData.season?.endDate) {
      return {
        progress: 0,
        daysRemaining: 0,
        isActive: false,
        hasStarted: false,
        hasEnded: false
      };
    }

    const start = new Date(teamData.season.startDate);
    const end = new Date(teamData.season.endDate);
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
  }, [teamData.season]);

  // Update bandwidth calculation with proper typing
  const bandwidth = useMemo(() => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(roster) ? roster : [];
    
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
  }, [roster, getNodes]);

  // Save data to backend
  const saveToBackend = async (field: string, value: any) => {
    try {
      const response = await GraphApiClient.updateNode('team' as NodeType, id, { [field]: value });
      console.log(`Updated team node ${id} ${field}`);
    } catch (error) {
      console.error(`Failed to update team node ${id}:`, error);
      toast.error(`Update Failed: Failed to save ${field} to the server.`);
    }
  };

  // Save roster to backend
  const saveRosterToBackend = async (roster: RosterMember[]) => {
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
      
      await saveToBackend('roster', validRoster);
      rosterDebounceRef.current = null;
    }, 1000);
  };

  // Save season to backend
  const saveSeasonToBackend = async (season: Season) => {
    if (seasonDebounceRef.current) clearTimeout(seasonDebounceRef.current);
    
    seasonDebounceRef.current = setTimeout(async () => {
      await saveToBackend('season', season);
      seasonDebounceRef.current = null;
    }, 1000);
  };

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    updateNodeData(id, { ...teamData, title: newTitle });
    
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    
    titleDebounceRef.current = setTimeout(async () => {
      await saveToBackend('title', newTitle);
      titleDebounceRef.current = null;
    }, 1000);
  }, [id, teamData, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    updateNodeData(id, { ...teamData, description: newDescription });
    
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    
    descriptionDebounceRef.current = setTimeout(async () => {
      await saveToBackend('description', newDescription);
      descriptionDebounceRef.current = null;
    }, 1000);
  }, [id, teamData, updateNodeData]);

  const handleSeasonChange = useCallback((updates: Partial<Season>) => {
    const defaultSeason: Season = {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      name: 'New Season'
    };

    const updatedSeason = { ...(teamData.season || defaultSeason), ...updates };
    
    updateNodeData(id, {
      ...teamData,
      season: updatedSeason
    });
    
    saveSeasonToBackend(updatedSeason);
  }, [id, teamData, updateNodeData]);

  const removeRosterMember = useCallback((memberId: string) => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(roster) ? roster : [];
    const updatedRoster = rosterArray.filter((member: RosterMember) => member.memberId !== memberId);
    
    updateNodeData(id, {
      ...teamData,
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
  }, [id, teamData, updateNodeData, edges, setEdges, roster]);

  const handleAllocationChange = useCallback((memberId: string, allocation: number) => {
    // Ensure roster is an array before using array methods
    const rosterArray = Array.isArray(roster) ? roster : [];
    const updatedRoster = rosterArray.map((member: RosterMember) => {
      if (member.memberId === memberId) {
        return { ...member, allocation };
      }
      return member;
    });
    
    updateNodeData(id, {
      ...teamData,
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
  }, [id, teamData, updateNodeData, getNodes, roster, saveRosterToBackend]);

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

  const handleDisconnect = useCallback((edgeId: string) => {
    GraphApiClient.deleteEdge('team' as NodeType, edgeId)
      .then(() => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      })
      .catch((error) => console.error('Failed to delete edge:', error));
  }, [setEdges]);

  // Initialize season with defaults if it doesn't exist
  useEffect(() => {
    if (!teamData.season) {
      const defaultSeason: Season = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        name: 'New Season'
      };
      
      updateNodeData(id, {
        ...teamData,
        season: defaultSeason
      });
      
      saveSeasonToBackend(defaultSeason);
    }
  }, [id, teamData, updateNodeData, saveSeasonToBackend]);

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
      if (seasonDebounceRef.current) clearTimeout(seasonDebounceRef.current);
      if (rosterDebounceRef.current) clearTimeout(rosterDebounceRef.current);
    };
  }, []);

  const connectedEdges = edges.filter((edge) => edge.source === id || edge.target === id);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={title}
            onChange={handleTitleChange}
            className="bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Team Name"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Team menu">
            <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
            {connectedEdges.map((edge) => (
              <DropdownMenuItem
                key={edge.id}
                onSelect={() => handleDisconnect(edge.id)}
                className="cursor-pointer text-red-500"
              >
                Disconnect {String(edge.data?.label || 'Edge')}
              </DropdownMenuItem>
            ))}
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>

      <div className="px-3 pb-3 space-y-4">
        {/* Season Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Season</Label>
            <Badge 
              variant={
                seasonProgress.hasEnded ? "secondary" :
                seasonProgress.isActive ? "default" : 
                "outline"
              }
            >
              {seasonProgress.hasEnded ? "Ended" :
               seasonProgress.isActive ? "Active" :
               "Not Started"}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={teamData.season?.startDate || '2025-01-01'}
                onChange={(e) => handleSeasonChange({ startDate: e.target.value })}
                className="bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={teamData.season?.endDate || '2025-12-31'}
                onChange={(e) => handleSeasonChange({ endDate: e.target.value })}
                className="bg-transparent"
              />
            </div>
          </div>
          
          {Boolean(teamData.season) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span>{Math.round(seasonProgress.progress)}%</span>
              </div>
              <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${seasonProgress.progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {seasonProgress.daysRemaining} days remaining
              </div>
            </div>
          )}
        </div>

        {/* Team Bandwidth Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Bandwidth</Label>
            <Badge variant="secondary">
              {Math.round(bandwidth.utilizationRate)}% utilized
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  bandwidth.utilizationRate > 90 ? 'bg-destructive' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(bandwidth.utilizationRate, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 text-xs text-muted-foreground">
              <div>{Math.round(bandwidth.total)} hours total</div>
              <div className="text-right">{Math.round(bandwidth.available)} hours available</div>
            </div>
          </div>
        </div>

        {/* Roster Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Roster</Label>
            <span className="text-xs text-muted-foreground">
              {Array.isArray(roster) ? roster.length : 0} members
            </span>
          </div>

          <div className="space-y-2">
            {Array.isArray(roster) && roster.map((member: RosterMember) => {
              const teamMember = getNodes().find(n => n.id === member.memberId);
              if (!isTeamMemberNode(teamMember)) return null;

              return (
                <div key={member.memberId} className="space-y-2 p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{String(teamMember.data.title || '')}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRosterMember(member.memberId)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{member.role}</span>
                      <span>{member.allocation}% allocated</span>
                    </div>
                    <Slider
                      value={[member.allocation]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(values) => handleAllocationChange(member.memberId, values[0])}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">
                      {Math.round((teamMember.data.weeklyCapacity * member.allocation) / 100)} hours per week
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Textarea
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Team description..."
          className="min-h-[80px] resize-y bg-transparent"
        />
      </div>

      <Handle
        type="source"
        position={Position.Top}
        id="source"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target"
      />
    </BaseNode>
  );
}
