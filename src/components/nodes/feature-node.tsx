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
import { useMemo, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RFFeatureNodeData } from '@/services/graph/feature/feature.types';
import { useFeatureNode } from '@/hooks/useFeatureNode';
import { useReactFlow } from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { CostReceipt } from '@/components/shared/CostReceipt';
import { TeamAllocation } from '@/components/shared/TeamAllocation';
import { formatHours } from '@/utils/format-utils';
import { formatMemberName } from '@/utils/node-utils';
import type { TeamAllocation as ITeamAllocation } from '@/utils/types/allocation';
/**
 * Interface for member cost data used in the cost receipt
 */
export interface MemberCost {
  memberId: string;
  name: string;
  hours: number;
  hourlyRate: number;
  cost: number;
}

// Use React.memo to prevent unnecessary re-renders
export const FeatureNode = memo(function FeatureNode({ id, data, selected }: NodeProps) {
  const { getNodes } = useReactFlow();
  
  // Use the feature node hook to manage state and operations
  const feature = useFeatureNode(id, data as RFFeatureNodeData);
  
  // Calculate project duration in days
  const projectDurationDays = Number(data.duration) || 1;
  
  // DEBUG: Log project duration days
  console.log('[FeatureNode] Project Duration Days:', {
    id,
    duration: data.duration,
    projectDurationDays,
    startDate: data.startDate,
    endDate: data.endDate
  });
  
  // Pre-calculate member allocations for display and cost calculation
  const memberAllocations = useMemo(() => {
    console.group('🎯 Team Roster Calculations');
    
    console.log('Connected Teams:', feature.connectedTeams);
    console.log('Processed Team Allocations:', feature.processedTeamAllocations);
    console.log('Project Duration Days:', projectDurationDays);

    const allocations = feature.calculateMemberAllocations(
      feature.connectedTeams,
      feature.processedTeamAllocations,
      projectDurationDays,
      formatMemberName
    );

    console.log('Calculated Member Allocations:', allocations);
    console.groupEnd();
    
    return allocations;
  }, [feature, projectDurationDays]);
  
  // Calculate cost summary
  const costSummary = useMemo(() => {
    if (!feature.calculateCostSummary) {
      return { totalCost: 0, totalHours: 0, totalDays: 0, allocations: [] };
    }
    
    return feature.calculateCostSummary(
      memberAllocations
    );
  }, [feature, memberAllocations]);
  
  const getMemberName = (memberId: string, memberData?: Record<string, unknown>): string => {
    return formatMemberName(memberId, getNodes(), memberData);
  };
  
  return (
    <BaseNode selected={selected} className="w-[400px]">
      <Handle type="source" position={Position.Top} id="source" />
      <Handle type="target" position={Position.Bottom} id="target" />
      
      <NodeHeader>
        <NodeHeaderTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`cursor-pointer ${feature.getStatusColor(feature.status)}`}
              onClick={feature.cycleStatus}
            >
              {feature.status}
            </Badge>
            <input
              value={feature.title}
              onChange={(e) => feature.handleTitleChange(e.target.value)}
              className="bg-transparent outline-none w-full"
              placeholder="Feature Title"
            />
          </div>
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <button 
            onClick={() => {
              feature.refreshData();
              feature.refreshConnectedTeamData();
            }}
            className="p-1 rounded-md hover:bg-muted"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NodeHeaderMenuAction label="Provider Actions">
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={feature.handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </NodeHeader>
      
      <div className="p-4 space-y-4">
        <Textarea
          placeholder="Describe this feature..."
          value={feature.description}
          onChange={(e) => feature.handleDescriptionChange(e.target.value)}
          className="min-h-[80px] resize-none"
        />
        
        <div className="space-y-2">
          <Label>Build Type</Label>
          {!feature.isLoading && (
            <RadioGroup
              key={`buildtype-${feature.buildType || 'internal'}`}
              value={feature.buildType || 'internal'}
              onValueChange={feature.handleBuildTypeChange}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="internal" id="internal" />
                <Label htmlFor="internal">Internal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external">External</Label>
              </div>
            </RadioGroup>
          )}
          {feature.isLoading && (
            <div className="text-sm text-muted-foreground">Loading...</div>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Time to Complete</Label>
            <Badge variant="outline" className="font-mono">
              {feature.duration.displayValue}
            </Badge>
          </div>
          <Input
            type="text"
            placeholder="e.g. 2w or 10d"
            value={feature.duration.value || ''}
            onChange={(e) => feature.handleDurationChange(e.target.value)}
            onBlur={() => {}}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={feature.startDate || ''}
              onChange={(e) => {
                if (e.target.value) {
                  feature.handleStartDateChange(e.target.value);
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input
              type="date"
              value={feature.endDate || ''}
              onChange={(e) => {
                if (e.target.value) {
                  feature.handleEndDateChange(e.target.value);
                }
              }}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>Resource Allocation</span>
            <Badge variant="outline" className="font-mono">
              {formatHours(costSummary.totalHours)}
            </Badge>
          </Label>
          
          {feature.connectedTeams.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Connect to teams to allocate resources
            </div>
          )}
          
          {feature.connectedTeams.map(team => (
            <TeamAllocation
              key={team.teamId}
              team={team}
              teamAllocation={feature.processedTeamAllocations.find((a: ITeamAllocation) => a.teamId === team.teamId)}
              memberAllocations={memberAllocations}
              projectDurationDays={projectDurationDays}
              formatMemberName={getMemberName}
              onMemberValueChange={(teamId, memberId, hours) => {
                feature.handleAllocationChangeLocal(teamId, memberId, hours);
              }}
              onMemberValueCommit={(teamId, memberId, hours) => {
                feature.handleAllocationCommit(teamId, memberId, hours);
              }}
              timeframe={feature.startDate && feature.endDate ? {
                startDate: feature.startDate,
                endDate: feature.endDate
              } : undefined}
            />
          ))}
        </div>
        
        {costSummary.allocations.length > 0 && (
          <CostReceipt
            allocations={costSummary.allocations}
            totalCost={costSummary.totalCost}
            totalHours={costSummary.totalHours}
            totalDays={costSummary.totalDays}
          />
        )}
      </div>
    </BaseNode>
  );
});

// Export the memoized component
export default FeatureNode;