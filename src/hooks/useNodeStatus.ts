import { useCallback } from 'react';

export type NodeStatus = 'planning' | 'in_progress' | 'completed' | 'active';

export type NodeStatusConfig = {
  canBeActive?: boolean; // Some nodes (like features) can be "active" after completion
  defaultStatus?: NodeStatus;
};

export function useNodeStatus(
  id: string,
  data: Record<string, any>,
  updateNodeData: (id: string, data: any) => void,
  config: NodeStatusConfig = {}
) {
  const getNextStatus = useCallback((currentStatus: NodeStatus, direction: 'forward' | 'backward'): NodeStatus => {
    const statusFlow: Record<NodeStatus, { forward: NodeStatus; backward: NodeStatus }> = {
      'planning': {
        forward: 'in_progress',
        backward: 'planning'
      },
      'in_progress': {
        forward: 'completed',
        backward: 'planning'
      },
      'completed': {
        forward: config.canBeActive ? 'active' : 'completed',
        backward: 'in_progress'
      },
      'active': {
        forward: 'active',
        backward: 'completed'
      }
    };
    return statusFlow[currentStatus][direction];
  }, [config.canBeActive]);

  const getStatusColor = useCallback((status: NodeStatus): string => {
    const colors: Record<NodeStatus, string> = {
      'planning': 'text-muted-foreground',
      'in_progress': 'text-blue-500',
      'completed': 'text-green-500',
      'active': 'text-purple-500'
    };
    return colors[status];
  }, []);

  const handleStatusChange = useCallback((newStatus: NodeStatus) => {
    updateNodeData(id, { ...data, status: newStatus });
  }, [id, data, updateNodeData]);

  const cycleStatus = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any bubbling
    const currentStatus = data.status || config.defaultStatus || 'planning';
    const direction = e.shiftKey ? 'backward' : 'forward';
    const nextStatus = getNextStatus(currentStatus, direction);
    handleStatusChange(nextStatus);
  }, [data.status, config.defaultStatus, getNextStatus, handleStatusChange]);

  return {
    status: data.status || config.defaultStatus || 'planning',
    getStatusColor,
    handleStatusChange,
    cycleStatus,
    getNextStatus
  };
} 