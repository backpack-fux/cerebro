import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHours } from "@/lib/utils";
import { useAllocationEngine } from "@/hooks/useAllocationEngine";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
/**
 * Safely format hours, handling undefined values
 */
const safeFormatHours = (hours: number | undefined): string => {
  if (hours === undefined || isNaN(Number(hours))) {
    return '0h';
  }
  return formatHours(Number(hours));
};

type EngineMemberAllocation = ReturnType<typeof useAllocationEngine>['memberAllocations'][string];

/**
 * Component for displaying member allocation conflicts
 */
export const AllocationConflicts = () => {
  const { memberAllocations } = useAllocationEngine();
  
  // Filter members with over-allocation
  const overAllocatedMembers = Object.values(memberAllocations).filter(
    (member): member is EngineMemberAllocation => member.isOverAllocated === true
  );
  
  if (overAllocatedMembers.length === 0) {
    return null;
  }
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Allocation Conflicts
        </CardTitle>
        <CardDescription>
          {overAllocatedMembers.length} team member{overAllocatedMembers.length > 1 ? 's are' : ' is'} over-allocated
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {overAllocatedMembers.map(member => (
            <MemberConflict 
              key={member.memberId}
              member={member}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

interface MemberConflictProps {
  member: EngineMemberAllocation;
}

/**
 * Component for displaying a single member's allocation conflict
 */
const MemberConflict: React.FC<MemberConflictProps> = ({ member }) => {
  return (
    <div className="border-l-2 border-destructive pl-3 py-1">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">{member.name}</h4>
        <Badge variant="outline" className="text-xs">
          {safeFormatHours(member.effectiveCapacity)}/week available
        </Badge>
      </div>
      
      <div className="mt-2 space-y-1 text-sm">
        <p>Allocated to:</p>
        <ul className="ml-4 list-disc space-y-1">
          {member.allocations?.map(allocation => (
            <li key={allocation.nodeId} className="text-xs">
              <span className="font-medium">{allocation.nodeName}</span>: 
              {safeFormatHours(allocation.weeklyHours)}/week 
              ({safeFormatHours(allocation.totalHours)} total)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}; 