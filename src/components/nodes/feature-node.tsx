"use client";

import { Handle, Position, type NodeProps, useEdges } from "@xyflow/react";
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
import { useResourceAllocation } from '@/hooks/useResourceAllocation';
import { useReactFlow } from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { CostReceipt } from '@/components/shared/CostReceipt';
import { TeamAllocation } from '@/components/shared/TeamAllocation';

/**
 * Utility function to format numbers in a user-friendly way
 * @param value The number to format
 * @returns Formatted string with at most 1 decimal place
 */
const formatNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  // Format with commas and no decimal places
  return num.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
};

/**
 * Format hours for display
 * @param hours The number of hours to format
 * @returns Formatted string representing the hours in a user-friendly format
 */
const formatHours = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${Math.round(hours * 10) / 10} hrs`;
};

/**
 * Interface for team member data
 */
interface TeamMember {
  memberId: string;
  name?: string;
  allocation?: number;
  role?: string;
}

/**
 * Interface for member cost data used in the cost receipt
 */
interface MemberCost {
  memberId: string;
  name: string;
  hours: number;
  hourlyRate: number;
  cost: number;
}

/**
 * Props for the CostReceipt component
 */
interface CostSummaryProps {
  allocations: MemberCost[];
  totalCost: number;
  totalHours: number;
  totalDays: number;
}

/**
 * Simple progress bar component
 */
const Progress: React.FC<{ value: number; className?: string }> = ({ value = 0, className = "" }) => {
  return (
    <div className={`w-full bg-muted rounded-full overflow-hidden ${className}`}>
      <div 
        className="bg-primary h-full transition-all duration-300 ease-in-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export const FeatureNode = memo(function FeatureNode({ id, data, selected }: NodeProps) {
  const { getNodes } = useReactFlow();
  const edges = useEdges();
  
  // Use the feature node hook to manage state and operations
  const feature = useFeatureNode(id, data as RFFeatureNodeData);
  
  // Format member name for display
  const formatMemberName = (memberId: string, memberData?: any): string => {
    // Try to get the name from the member data first
    if (memberData?.name) return memberData.name;
    
    // Otherwise, try to find the node in the graph
    const nodes = getNodes();
    const memberNode = nodes.find(n => n.id === memberId);
    
    // If we found the node, use its title
    if (memberNode?.data?.title) {
      return String(memberNode.data.title);
    }
    
    // Last resort: use the first part of the ID
    return memberId.split('-')[0];
  };
  
  // Calculate project duration in days
  const projectDurationDays = Number(data.duration) || 1;
  
  // Pre-calculate member allocations for display and cost calculation
  const memberAllocations = useMemo(() => {
    if (!feature.calculateMemberAllocations) return new Map();
    
    return feature.calculateMemberAllocations(
      feature.connectedTeams,
      feature.processedTeamAllocations,
      projectDurationDays,
      formatMemberName
    );
  }, [
    feature.connectedTeams, 
    feature.processedTeamAllocations, 
    projectDurationDays, 
    formatMemberName,
    feature.calculateMemberAllocations
  ]);
  
  // Calculate cost summary
  const costSummary = useMemo(() => {
    if (!feature.calculateCostSummary) {
      return { totalCost: 0, totalHours: 0, totalDays: 0, allocations: [] };
    }
    
    return feature.calculateCostSummary(
      memberAllocations
    );
  }, [memberAllocations, feature.calculateCostSummary]);
  
  return (
    <BaseNode selected={selected} className="w-[400px]">
      <Handle type="source" position={Position.Top} id="source" />
      <Handle type="target" position={Position.Bottom} id="target" />
      
      <NodeHeader>
        <NodeHeaderTitle>
          <input
            value={feature.title}
            onChange={(e) => feature.handleTitleChange(e.target.value)}
            className="bg-transparent outline-none w-full"
            placeholder="Feature Name"
          />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <button 
            onClick={feature.refreshData}
            className="p-1 rounded-md hover:bg-muted"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NodeHeaderMenuAction label="Feature Actions">
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
            onChange={(e) => feature.duration.handleDurationChange(e.target.value)}
            onBlur={() => {}}
          />
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
              teamAllocation={feature.processedTeamAllocations.find(a => a.teamId === team.teamId)}
              memberAllocations={memberAllocations}
              projectDurationDays={projectDurationDays}
              formatMemberName={formatMemberName}
              onMemberValueChange={feature.handleAllocationChangeLocal}
              onMemberValueCommit={feature.handleAllocationCommit}
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