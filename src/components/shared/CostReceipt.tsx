"use client";

import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatHours } from "@/lib/utils";

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

/**
 * Props for the CostReceipt component
 */
export interface CostSummaryProps {
  allocations: MemberCost[];
  totalCost: number;
  totalHours: number;
  totalDays: number;
}

/**
 * Cost receipt component that displays member allocations and total cost
 * Shared between feature and option nodes
 */
export const CostReceipt: React.FC<CostSummaryProps> = ({ 
  allocations, 
  totalCost, 
  totalHours, 
  totalDays 
}) => {
  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Cost Estimate</span>
        </div>
        <Badge variant="secondary">
          ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Badge>
      </div>
      
      {/* Member Allocations */}
      <div className="space-y-2 text-sm">
        {allocations.map((allocation: MemberCost) => (
          <div key={allocation.memberId} className="flex justify-between items-center border-b border-muted pb-1">
            <div>
              <span>{allocation.name}</span>
              <div className="text-xs text-muted-foreground">
                {formatHours(allocation.hours)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono">
                ${allocation.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">
                ${allocation.hourlyRate}/hour
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Totals */}
      <div className="flex justify-between items-center text-sm pt-1">
        <div>
          <div className="text-muted-foreground">Total Resource Cost</div>
          <div className="text-xs text-muted-foreground">
            {totalHours.toFixed(1)} hours ({totalDays.toFixed(1)} days)
          </div>
        </div>
        <div className="text-right font-medium">
          ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}; 