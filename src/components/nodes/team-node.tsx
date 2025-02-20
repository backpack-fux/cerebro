"use client";

import { Handle, Position, type NodeProps, type Node, useReactFlow, useNodeConnections } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useCallback, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { Role } from "./team-member-node";

type Season = {
  startDate: string;
  endDate: string;
  name: string;
  goals?: string[];
};

// First, let's properly type the team member node data
type TeamMemberNodeData = {
  title: string;
  weeklyCapacity: number;
  dailyRate?: number;
  allocations?: {
    nodeId: string;
    percentage: number;
  }[];
};

type RosterMember = {
  memberId: string;
  allocation: number; // Total percentage of member's time allocated to this team
  role: Role;
  startDate?: string;
  endDate?: string;
  allocations?: {
    nodeId: string; // ID of feature/provider/option
    percentage: number; // Percentage of their team allocation
  }[];
};

// First, let's create a type for the member we're creating from connections
type NewRosterMember = {
  memberId: string;
  role: Role;
  allocation: number;
  startDate: string;  // This is required for new members
  allocations: never[];  // Empty array for new members
};

export type TeamNodeData = Node<{
  title: string;
  description?: string;
  season?: Season;
  roster: RosterMember[]; // Make roster non-optional with empty array default
}>;

// Improve the type guard
function isTeamMemberNode(node: Node | undefined): node is Node<TeamMemberNodeData> {
  return Boolean(
    node?.type === 'teamMember' && 
    node.data && 
    typeof node.data.title === 'string' && 
    typeof node.data.weeklyCapacity === 'number'
  );
}

export function TeamNode({ id, data, selected }: NodeProps<TeamNodeData>) {
  const { updateNodeData, setNodes, getNodes } = useReactFlow();
  const connections = useNodeConnections({ id });

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

        // Create a new roster member with 0% initial allocation
        const newMember: NewRosterMember = {
          memberId: memberNode.id,
          role: memberNode.data.role as Role,
          allocation: 0,  // Start at 0% instead of 100%
          startDate: new Date().toISOString().split('T')[0],
          allocations: []
        };
        return newMember;
      })
      .filter((member): member is NewRosterMember => member !== null);

    // Add new members to roster
    const currentMemberIds = new Set(data.roster?.map(m => m.memberId));
    const newMembers = connectedMembers.filter(member => !currentMemberIds.has(member.memberId));

    if (newMembers.length > 0) {
      updateNodeData(id, {
        ...data,
        roster: [...(data.roster || []), ...newMembers]
      });
    }
  }, [connections, data, id, updateNodeData, getNodes]);

  // Initialize data with defaults
  const initialData = {
    ...data,
    roster: data.roster || []
  };

  // Calculate season progress
  const seasonProgress = useMemo(() => {
    if (!data.season?.startDate || !data.season?.endDate) {
      return {
        progress: 0,
        daysRemaining: 0,
        isActive: false,
        hasStarted: false,
        hasEnded: false
      };
    }

    const start = new Date(data.season.startDate);
    const end = new Date(data.season.endDate);
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
  }, [data.season]);

  // Update bandwidth calculation with proper typing
  const bandwidth = useMemo(() => {
    const teamMembers = getNodes()
      .filter(node => 
        node.type === 'teamMember' && 
        initialData.roster.some(member => member.memberId === node.id)
      )
      .filter(isTeamMemberNode);

    // Calculate total team bandwidth from member allocations
    const total = initialData.roster.reduce((sum, member) => {
      const teamMember = teamMembers.find(tm => tm.id === member.memberId);
      if (teamMember) {
        return sum + (teamMember.data.weeklyCapacity * (member.allocation / 100));
      }
      return sum;
    }, 0);

    // Calculate allocated bandwidth to work nodes
    const allocated = initialData.roster.reduce((sum, member) => {
      const memberAllocations = member.allocations || [];
      const teamMember = teamMembers.find(tm => tm.id === member.memberId);
      if (!teamMember) return sum;

      const memberTotal = memberAllocations.reduce((memberSum: number, allocation) => {
        return memberSum + (allocation.percentage / 100) * 
          (teamMember.data.weeklyCapacity * (member.allocation / 100));
      }, 0);

      return sum + memberTotal;
    }, 0);

    return {
      total,
      allocated,
      available: total - allocated,
      utilizationRate: total > 0 ? (allocated / total) * 100 : 0
    };
  }, [initialData.roster, getNodes]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, title: e.target.value });
  }, [id, data, updateNodeData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, description: e.target.value });
  }, [id, data, updateNodeData]);

  const handleSeasonChange = useCallback((updates: Partial<Season>) => {
    const defaultSeason: Season = {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: 'New Season'
    };

    updateNodeData(id, {
      ...data,
      season: { ...(data.season || defaultSeason), ...updates }
    });
  }, [id, data, updateNodeData]);

  const removeRosterMember = useCallback((memberId: string) => {
    updateNodeData(id, {
      ...data,
      roster: data.roster?.filter(member => member.memberId !== memberId) || []
    });
  }, [id, data, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={data.title}
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
                value={data.season?.startDate || ''}
                onChange={(e) => handleSeasonChange({ startDate: e.target.value })}
                className="bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={data.season?.endDate || ''}
                onChange={(e) => handleSeasonChange({ endDate: e.target.value })}
                className="bg-transparent"
              />
            </div>
          </div>
          
          {data.season && (
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
              {data.roster?.length || 0} members
            </span>
          </div>

          <div className="space-y-2">
            {data.roster?.map(member => {
              const teamMember = getNodes().find(n => n.id === member.memberId);
              if (!isTeamMemberNode(teamMember)) return null;

              return (
                <div key={member.memberId} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{teamMember.data.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {member.role} • {member.allocation}% allocated
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRosterMember(member.memberId)}
                    className="h-6 w-6 p-0"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <Textarea
          value={data.description || ''}
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
