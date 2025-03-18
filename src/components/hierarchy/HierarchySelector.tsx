import React, { useState, useEffect } from 'react';
import { NodeType } from '@/services/graph/neo4j/api-urls';
import { createParentChildRelationship, removeParentChildRelationship, getNodeParent, getNodeChildren } from '@/services/graph/hierarchy/hierarchy.service';

interface HierarchySelectorProps {
  nodeId: string;
  nodeType: NodeType;
  availableNodes: Array<{
    id: string;
    title: string;
  }>;
  onChange?: () => void;
}

/**
 * Component for selecting parent-child relationships for a node
 */
export function HierarchySelector({ nodeId, nodeType, availableNodes, onChange }: HierarchySelectorProps) {
  const [parent, setParent] = useState<{ id: string; title: string } | null>(null);
  const [children, setChildren] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // Get parent
        const parentData = await getNodeParent(nodeType, nodeId);
        if (parentData) {
          setParent({
            id: parentData.id,
            title: parentData.title
          });
        }
        
        // Get children
        const childrenData = await getNodeChildren(nodeType, nodeId);
        setChildren(childrenData.map((child: any) => ({
          id: child.id,
          title: child.title
        })));
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching hierarchy data:', err);
        setError('Failed to load hierarchical relationships');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [nodeId, nodeType]);
  
  // Handle parent selection
  const handleParentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    
    try {
      setLoading(true);
      setError(null);
      
      // If there was a previous parent, remove the relationship
      if (parent) {
        await removeParentChildRelationship(nodeType, parent.id, nodeId);
      }
      
      // If a new parent is selected (not "None"), create the relationship
      if (parentId !== "none") {
        await createParentChildRelationship(nodeType, parentId, nodeId);
        
        // Find the parent node in available nodes
        const selectedParent = availableNodes.find(node => node.id === parentId);
        if (selectedParent) {
          setParent(selectedParent);
        }
      } else {
        setParent(null);
      }
      
      setLoading(false);
      if (onChange) onChange();
    } catch (err) {
      console.error('Error updating parent relationship:', err);
      setError('Failed to update parent relationship');
      setLoading(false);
    }
  };
  
  // Handle removing a child
  const handleRemoveChild = async (childId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await removeParentChildRelationship(nodeType, nodeId, childId);
      
      // Update the children list
      setChildren(children.filter(child => child.id !== childId));
      
      setLoading(false);
      if (onChange) onChange();
    } catch (err) {
      console.error('Error removing child relationship:', err);
      setError('Failed to remove child relationship');
      setLoading(false);
    }
  };
  
  // Handle adding a child
  const handleAddChild = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const childId = e.target.value;
    if (childId === "none") return;
    
    try {
      setLoading(true);
      setError(null);
      
      await createParentChildRelationship(nodeType, nodeId, childId);
      
      // Find the child node in available nodes
      const selectedChild = availableNodes.find(node => node.id === childId);
      if (selectedChild) {
        setChildren([...children, selectedChild]);
      }
      
      // Reset the select dropdown
      e.target.value = "none";
      
      setLoading(false);
      if (onChange) onChange();
    } catch (err) {
      console.error('Error adding child relationship:', err);
      setError('Failed to add child relationship');
      setLoading(false);
    }
  };
  
  // Filter out nodes that are already children or the node itself
  const availableParents = availableNodes.filter(
    node => node.id !== nodeId && !children.some(child => child.id === node.id)
  );
  
  // Filter out nodes that are already parent or the node itself or already children
  const availableChildNodes = availableNodes.filter(
    node => node.id !== nodeId && 
           (parent === null || node.id !== parent.id) && 
           !children.some(child => child.id === node.id)
  );
  
  return (
    <div className="hierarchy-selector">
      <div className="mb-4">
        <h3 className="text-lg font-medium">Hierarchical Relationships</h3>
        {error && <div className="text-red-500 mb-2">{error}</div>}
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Parent Node
        </label>
        <select
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={parent?.id || "none"}
          onChange={handleParentChange}
          disabled={loading}
        >
          <option value="none">None</option>
          {availableParents.map(node => (
            <option key={node.id} value={node.id}>
              {node.title}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Child Nodes
        </label>
        
        {children.length > 0 ? (
          <ul className="divide-y divide-gray-200 border rounded-md mb-2">
            {children.map(child => (
              <li key={child.id} className="flex justify-between items-center p-2">
                <span>{child.title}</span>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveChild(child.id)}
                  disabled={loading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 mb-2">No child nodes</p>
        )}
        
        <select
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          onChange={handleAddChild}
          disabled={loading}
          defaultValue="none"
        >
          <option value="none">Add a child...</option>
          {availableChildNodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.title}
            </option>
          ))}
        </select>
      </div>
      
      {loading && (
        <div className="mt-2 text-gray-500">Loading...</div>
      )}
    </div>
  );
} 