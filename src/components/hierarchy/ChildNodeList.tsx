import React, { useState, useEffect } from 'react';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { getNodeChildren, removeParentChildRelationship } from '@/services/graph/hierarchy/hierarchy.service';

interface ChildNode {
  id: string;
  title: string;
  originalEstimate?: number;
  rollupEstimate?: number;
  rollupContribution?: boolean;
}

interface ChildNodeListProps {
  nodeId: string;
  nodeType: NodeType;
  onRemoveChild?: (childId: string) => void;
  onUpdateComplete?: () => void;
  className?: string;
}

/**
 * Component to display a list of child nodes for a parent node
 */
export function ChildNodeList({ 
  nodeId, 
  nodeType, 
  onRemoveChild, 
  onUpdateComplete,
  className = '' 
}: ChildNodeListProps) {
  const [children, setChildren] = useState<ChildNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch children data
  useEffect(() => {
    async function fetchChildren() {
      try {
        setLoading(true);
        setError(null);
        
        const childrenData = await getNodeChildren(nodeType, nodeId);
        
        // Map data to our simpler format
        const formattedChildren = childrenData.map((child) => {
          // Create a properly typed child object
          const typedChild: ChildNode = {
            id: child.id,
            title: child.data?.title?.toString() || child.title || 'Untitled',
            originalEstimate: typeof child.data?.originalEstimate === 'number' ? child.data.originalEstimate : undefined,
            rollupEstimate: typeof child.data?.rollupEstimate === 'number' ? child.data.rollupEstimate : undefined,
            rollupContribution: child.rollupContribution
          };
          return typedChild;
        });
        
        setChildren(formattedChildren);
        setLoading(false);
        
        if (onUpdateComplete) {
          onUpdateComplete();
        }
      } catch (err) {
        console.error('Error fetching child nodes:', err);
        setError('Failed to load child nodes');
        setLoading(false);
      }
    }
    
    fetchChildren();
  }, [nodeId, nodeType, onUpdateComplete]);
  
  // Handle removing a child
  const handleRemoveChild = async (childId: string) => {
    try {
      setLoading(true);
      
      await removeParentChildRelationship(nodeType, nodeId, childId);
      
      // Update local state
      setChildren(prevChildren => prevChildren.filter(child => child.id !== childId));
      
      // Call external handler if provided
      if (onRemoveChild) {
        onRemoveChild(childId);
      }
      
      setLoading(false);
      
      if (onUpdateComplete) {
        onUpdateComplete();
      }
    } catch (err) {
      console.error('Error removing child relationship:', err);
      setError('Failed to remove child relationship');
      setLoading(false);
    }
  };
  
  // Format a time value
  const formatEstimate = (value: number | undefined) => {
    if (typeof value !== 'number') return 'N/A';
    return value.toFixed(1);
  };
  
  if (loading && children.length === 0) {
    return (
      <div className={`child-node-list ${className}`}>
        <div className="text-gray-500">Loading child nodes...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`child-node-list ${className}`}>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  if (children.length === 0) {
    return (
      <div className={`child-node-list ${className}`}>
        <div className="text-gray-500">No child nodes found</div>
      </div>
    );
  }
  
  return (
    <div className={`child-node-list ${className}`}>
      <h3 className="text-lg font-medium mb-2">Child Nodes</h3>
      
      <div className="overflow-hidden border rounded-md">
        {/* Table header */}
        <div className="grid grid-cols-12 bg-gray-50 border-b">
          <div className="col-span-6 p-2 font-medium">Name</div>
          <div className="col-span-2 p-2 font-medium text-right">Direct</div>
          <div className="col-span-2 p-2 font-medium text-right">Total</div>
          <div className="col-span-2 p-2"></div>
        </div>
        
        {/* Table body */}
        <div className="divide-y">
          {children.map(child => (
            <div key={child.id} className="grid grid-cols-12 hover:bg-gray-50">
              <div className="col-span-6 p-2 truncate">{child.title}</div>
              <div className="col-span-2 p-2 text-right">{formatEstimate(child.originalEstimate)}</div>
              <div className="col-span-2 p-2 text-right">{formatEstimate(child.rollupEstimate)}</div>
              <div className="col-span-2 p-2 text-right">
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 text-sm"
                  onClick={() => handleRemoveChild(child.id)}
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {loading && (
        <div className="mt-2 text-gray-500 text-sm">Updating...</div>
      )}
    </div>
  );
} 