"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from '@/components/nodes/base-node';
import { 
  NodeHeader,
  NodeHeaderTitle,
  NodeHeaderActions,
  NodeHeaderMenuAction,
} from '@/components/nodes/node-header';
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { RFTeamNodeData } from '@/services/graph/team/team.types';
import { useTeamNode } from '@/hooks/useTeamNode';

// Use React.memo to prevent unnecessary re-renders
const TeamNode = memo(function TeamNode({ id, data, selected }: NodeProps) {
  // Use our custom hook for team node logic
  const team = useTeamNode(id, data as RFTeamNodeData);
  
  return (
    <BaseNode selected={selected}>
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={team.title}
            onChange={(e) => team.handleTitleChange(e.target.value)}
            className="bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Team Name"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Team menu">
            <DropdownMenuItem onSelect={team.handleDelete} className="cursor-pointer">
              Delete
            </DropdownMenuItem>
            {team.connectedEdges.map((edge) => (
              <DropdownMenuItem
                key={edge.id}
                onSelect={() => team.handleDisconnect(edge.id)}
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
                team.seasonProgress.hasEnded ? "secondary" :
                team.seasonProgress.isActive ? "default" : 
                "outline"
              }
            >
              {team.seasonProgress.hasEnded ? "Ended" :
               team.seasonProgress.isActive ? "Active" :
               "Not Started"}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={team.season?.startDate || '2025-01-01'}
                onChange={(e) => team.handleSeasonChange({ startDate: e.target.value })}
                className="bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={team.season?.endDate || '2025-12-31'}
                onChange={(e) => team.handleSeasonChange({ endDate: e.target.value })}
                className="bg-transparent"
              />
            </div>
          </div>
          
          {Boolean(team.season) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span>{Math.round(team.seasonProgress.progress)}%</span>
              </div>
              <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${team.seasonProgress.progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {team.seasonProgress.daysRemaining} days remaining
              </div>
            </div>
          )}
        </div>

        {/* Team Bandwidth Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Bandwidth</Label>
            <Badge variant="secondary">
              {Math.round(team.bandwidth.utilizationRate)}% utilized
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  team.bandwidth.utilizationRate > 90 ? 'bg-destructive' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(team.bandwidth.utilizationRate, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 text-xs text-muted-foreground">
              <div>{Math.round(team.bandwidth.total)} hours total</div>
              <div className="text-right">{Math.round(team.bandwidth.available)} hours available</div>
            </div>
          </div>
        </div>

        {/* Roster Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Roster</Label>
            <span className="text-xs text-muted-foreground">
              {Array.isArray(team.processedRoster) ? team.processedRoster.length : 0} members
            </span>
          </div>

          <div className="space-y-2">
            {Array.isArray(team.processedRoster) && team.processedRoster.map((member) => {
              const teamMember = team.getNodes().find(n => n.id === member.memberId);
              if (!team.isTeamMemberNode(teamMember)) return null;

              return (
                <div key={member.memberId} className="space-y-2 p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{String(teamMember.data.title || '')}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => team.removeRosterMember(member.memberId)}
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
                      onValueChange={(values) => team.handleAllocationChange(member.memberId, values[0])}
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
          value={team.description}
          onChange={(e) => team.handleDescriptionChange(e.target.value)}
          placeholder="Team description..."
          className="min-h-[80px] resize-y bg-transparent"
        />
      </div>

      <Handle
        type="source"
        position={Position.Top}
        id="source"
        className="w-3 h-3 bg-primary"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target"
        className="w-3 h-3 bg-primary"
      />
    </BaseNode>
  );
});

// Export the memoized component
export { TeamNode };
