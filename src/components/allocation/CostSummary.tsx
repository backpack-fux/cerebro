import React from 'react';

interface MemberCost {
  member: {
    memberId: string;
    name: string;
    dailyRate: number;
  };
  allocation: number;
  allocatedDays: number;
  hours: number;
  hoursPerDay?: number;
  startDate?: string;
  endDate?: string;
  cost: number;
}

export interface CostSummary {
  dailyCost: number;
  totalCost: number;
  totalHours: number;
  totalDays: number;
  calendarDuration?: number;
  allocations: Array<MemberCost>;
}

export interface CostSummaryProps {
  costs: CostSummary;
  duration?: number;
}

export const CostSummaryComponent: React.FC<CostSummaryProps> = ({ costs, duration }) => {
  return (
    <div className="space-y-4">
      {/* Member Allocations */}
      <div className="space-y-2">
        {costs.allocations.map(allocation => (
          <div key={allocation.member.memberId} className="flex justify-between items-center text-sm">
            <div className="space-y-1">
              <span className="font-medium">{allocation.member.name}</span>
              <div className="text-muted-foreground">
                {allocation.allocatedDays.toFixed(1)} days ({allocation.allocation.toFixed(1)}%)
              </div>
              {allocation.startDate && allocation.endDate && (
                <div className="text-xs text-muted-foreground">
                  {new Date(allocation.startDate).toLocaleDateString()} - {new Date(allocation.endDate).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-muted-foreground">
                ${allocation.cost.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {allocation.hours.toFixed(1)} hours
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium">Total Resource Cost</span>
          <span className="font-mono">
            ${costs.totalCost.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
          <span>Daily Rate</span>
          <span className="font-mono">
            ${costs.dailyCost.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Total Hours</span>
          <span className="font-mono">{costs.totalHours.toFixed(1)} hours</span>
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Working Days</span>
          <span className="font-mono">{costs.totalDays.toFixed(1)} days</span>
        </div>

        {costs.calendarDuration && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Calendar Duration</span>
            <span className="font-mono">{costs.calendarDuration} days</span>
          </div>
        )}

        {duration && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Planned Duration</span>
            <span className="font-mono">{duration} days</span>
          </div>
        )}
      </div>
    </div>
  );
}; 