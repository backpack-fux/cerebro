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
import { useMemo, memo, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RFFeatureNodeData } from '@/services/graph/feature/feature.types';
import { HierarchicalNodeData } from '@/services/graph/hierarchy/hierarchy.types';
import { useFeatureNode } from '@/hooks/useFeatureNode';
import { useReactFlow } from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { CostReceipt } from '@/components/shared/CostReceipt';
import { TeamAllocation } from '@/components/shared/TeamAllocation';
import { formatHours } from '@/utils/format-utils';
import { formatMemberName } from '@/utils/node-utils';

import { MemberAllocationData as ImportedMemberAllocationData, AvailableMember } from '@/utils/types/allocation';
import { HierarchySelector } from '@/components/hierarchy/HierarchySelector';
import { RollupSummary } from '@/components/hierarchy/RollupSummary';
import { ChildNodeList } from '@/components/hierarchy/ChildNodeList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// Calculate cost summary from team allocations and resource allocations
interface CostSummary {
  totalCost: number;
  totalHours: number;
  totalDays: number;
  allocations: MemberCost[];
}

// Use React.memo to prevent unnecessary re-renders
export const FeatureNode = memo(function FeatureNode({ id, data, selected }: NodeProps) {
  const { getNodes } = useReactFlow();
  
  // Use the feature node hook to manage state and operations
  const feature = useFeatureNode(id, data as RFFeatureNodeData);
  
  // Calculate project duration in days
  const projectDurationDays = Number(data.duration) || 1;
  
  // Get all feature nodes to create a list of available nodes for the hierarchy selector
  const availableNodes = useMemo(() => {
    const allNodes = getNodes();
    const featureNodes = allNodes.filter(node => node.type === 'feature' && node.id !== id);
    return featureNodes.map(node => ({
      id: node.id,
      title: node.data?.title?.toString() || 'Untitled Feature'
    }));
  }, [getNodes, id]);

  // Cast data to HierarchicalNodeData for proper type checking with hierarchy components
  const hierarchyData = data as unknown as HierarchicalNodeData;
  
  // Format member names for a specific team
  const formatMemberNameForTeam = useCallback((memberId: string, member: AvailableMember): string => {
    return member.name || formatMemberName(memberId, getNodes(), { title: member.name });
  }, [getNodes]);
  
  // Convert to proper format for TeamAllocation component
  const teamDataEntries = useMemo(() => {
    if (!feature.connectedTeams) return [];
    
    return feature.connectedTeams.map(team => ({
      teamId: team.teamId,
      name: team.name || `Team ${team.teamId}`,
      availableBandwidth: team.availableBandwidth || []
    }));
  }, [feature.connectedTeams]);
  
  // Create a map of member allocations
  const memberAllocationsMap = useMemo(() => {
    const map = new Map<string, ImportedMemberAllocationData>();
    
    if (feature.processedTeamAllocations) {
      feature.processedTeamAllocations.forEach(team => {
        if (team.allocatedMembers) {
          team.allocatedMembers.forEach(member => {
            map.set(member.memberId, {
              memberId: member.memberId,
              name: member.name || 'Unknown Member',
              hours: member.hours,
              cost: member.hours * 100, // Simple cost calculation
              // These are optional properties, so we can safely omit them
            });
          });
        }
      });
    }
    
    return map;
  }, [feature.processedTeamAllocations]);
  
  // Simplified cost summary for the CostReceipt component
  const costSummary: CostSummary = useMemo(() => {
    let totalHours = 0;
    const allocations: MemberCost[] = [];
    
    if (feature.processedTeamAllocations) {
      feature.processedTeamAllocations.forEach(team => {
        if (team.allocatedMembers) {
          team.allocatedMembers.forEach(member => {
            totalHours += member.hours || 0;
            
            allocations.push({
              memberId: member.memberId,
              name: member.name || 'Unknown Member',
              hours: member.hours || 0,
              hourlyRate: 100, // Default rate
              cost: (member.hours || 0) * 100 // Simple calculation
            });
          });
        }
      });
    }
    
    return {
      totalCost: totalHours * 100, // Simple calculation
      totalHours,
      totalDays: totalHours / 8, // Assuming 8 hours per day
      allocations
    };
  }, [feature.processedTeamAllocations]);

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
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="p-4 space-y-4">
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
          
          {hierarchyData.hierarchy && (
            <RollupSummary nodeData={hierarchyData} className="mt-4" />
          )}
        </TabsContent>
        
        <TabsContent value="hierarchy" className="p-4 space-y-4">
          <HierarchySelector 
            nodeId={id} 
            nodeType="feature" 
            availableNodes={availableNodes}
            onChange={() => {
              feature.refreshData();
            }}
          />
          
          {/* Always show RollupSummary if there's a cost, even without hierarchy data */}
          <RollupSummary nodeData={{
            ...hierarchyData,
            cost: typeof data.cost === 'number' ? data.cost : undefined
          }} className="mt-4 p-2 border border-slate-200 rounded" />
          
          {hierarchyData.hierarchy && hierarchyData.hierarchy.childIds && hierarchyData.hierarchy.childIds.length > 0 && (
            <ChildNodeList
              nodeId={id}
              nodeType="feature"
              onUpdateComplete={() => {
                feature.refreshData();
              }}
              className="mt-4"
            />
          )}
        </TabsContent>
        
        <TabsContent value="resources" className="p-4 space-y-4">
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <span>Team Resources</span>
              <Badge variant="outline" className="font-mono">
                {formatHours(costSummary.totalHours)}
              </Badge>
            </Label>
            
            {teamDataEntries.length > 0 ? (
              teamDataEntries.map(team => (
                <TeamAllocation
                  key={team.teamId}
                  team={team}
                  teamAllocation={feature.processedTeamAllocations.find(a => a.teamId === team.teamId)}
                  memberAllocations={memberAllocationsMap}
                  projectDurationDays={projectDurationDays}
                  formatMemberName={formatMemberNameForTeam}
                  onMemberValueChange={(teamId, memberId, hours) => {
                    // Handle member value change
                    if (feature.handleAllocationChangeLocal) {
                      feature.handleAllocationChangeLocal(teamId, memberId, hours);
                    }
                  }}
                  onMemberValueCommit={(teamId, memberId, hours) => {
                    // Handle member value commit
                    if (feature.handleAllocationCommit) {
                      feature.handleAllocationCommit(teamId, memberId, hours);
                    }
                  }}
                />
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Connect to teams to allocate resources
              </div>
            )}
          </div>
          
          {costSummary.allocations.length > 0 && (
            <CostReceipt
              allocations={costSummary.allocations}
              totalCost={costSummary.totalCost}
              totalHours={costSummary.totalHours}
              totalDays={costSummary.totalDays}
            />
          )}
        </TabsContent>
      </Tabs>
    </BaseNode>
  );
});

// Export the memoized component
export default FeatureNode;