import React, { useEffect } from 'react';
import { HierarchicalNodeData } from '@/services/graph/hierarchy/hierarchy.types';

interface RollupSummaryProps {
  nodeData: HierarchicalNodeData & { cost?: number };
  className?: string;
}

/**
 * Component to display rollup summary for hierarchical nodes
 * Shows the original estimate, rollup estimate, cost, and the breakdown
 */
export function RollupSummary({ nodeData, className = '' }: RollupSummaryProps) {
  const { originalEstimate, rollupEstimate, hierarchy, cost } = nodeData;
  const hasHierarchy = hierarchy && (hierarchy.isRollup || hierarchy.childIds?.length > 0);
  
  // Log the data received for debugging
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RollupSummary] Rendering with data:', { 
        nodeData, 
        cost, 
        hasHierarchy,
        childIds: hierarchy?.childIds || [],
        isRollup: hierarchy?.isRollup
      });
    }
  }, [nodeData, cost, hasHierarchy, hierarchy]);
  
  // Always show the component if we have cost, even if hierarchy is missing
  const shouldShow = hasHierarchy || typeof cost === 'number';
  
  // If there's nothing to show, don't render
  if (!shouldShow) {
    return null;
  }
  
  const isRollup = hierarchy?.isRollup;
  const hasChildren = hierarchy?.childIds && hierarchy.childIds.length > 0;
  const hasRollupEstimate = typeof rollupEstimate === 'number';
  const hasOriginalEstimate = typeof originalEstimate === 'number';
  const hasCost = typeof cost === 'number';
  
  // Format a time value (convert to days if needed)
  const formatTime = (value: number | undefined) => {
    if (typeof value !== 'number') return 'N/A';
    
    // For simplicity, we'll just display the raw number. In a real application,
    // you might want to add unit conversion (e.g., hours to days)
    return value.toFixed(1);
  };

  // Format cost value as currency
  const formatCost = (value: number | undefined) => {
    if (typeof value !== 'number') return 'N/A';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className={`rollup-summary ${className}`}>
      {/* Always show the cost section at the top, if available */}
      {hasCost && (
        <>
          <h3 className="text-lg font-medium mb-2 bg-slate-800 p-2 rounded text-white">
            Cost Summary: {formatCost(cost)}
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="text-gray-600">Total Cost:</div>
            <div className="font-bold">{formatCost(cost)}</div>
          </div>
        </>
      )}
      
      {/* Time estimates section */}
      {(hasRollupEstimate || hasOriginalEstimate) && (
        <>
          <h3 className="text-lg font-medium mb-2 mt-4">Time Estimates</h3>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Show original estimate if available */}
            {hasOriginalEstimate && (
              <>
                <div className="text-gray-600">Direct Estimate:</div>
                <div>{formatTime(originalEstimate)}</div>
              </>
            )}
            
            {/* Show rollup estimate for parent nodes */}
            {isRollup && hasRollupEstimate && (
              <>
                <div className="text-gray-600">Total Estimate:</div>
                <div className="font-bold">{formatTime(rollupEstimate)}</div>
              </>
            )}
            
            {/* If it's a rollup node, show the difference */}
            {isRollup && hasRollupEstimate && hasOriginalEstimate && (
              <>
                <div className="text-gray-600">Child Contributions:</div>
                <div>{formatTime((rollupEstimate || 0) - (originalEstimate || 0))}</div>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Explain what's happening for the user */}
      {isRollup && hasChildren && (
        <div className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded">
          {hasOriginalEstimate ? (
            <p>
              This feature includes both direct work and work from {hierarchy?.childIds.length} sub-features.
              The total time estimate and cost includes both.
            </p>
          ) : (
            <p>
              This is a parent feature that aggregates work from {hierarchy?.childIds.length} sub-features.
              It doesn't have its own direct time estimate.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 