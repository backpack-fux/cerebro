import { useCallback } from 'react';
import { formatDuration, parseDurationString, isValidDuration } from '@/utils/time/duration';

export type DurationConfig = {
  maxDays: number;
  label: string;
  fieldName: string;
  tip?: string;
};

export type NodeData = {
  [key: string]: unknown;
  duration?: number;
  timeToClose?: number;
  buildDuration?: number;
};

export function useDurationInput(
  id: string, 
  data: NodeData,
  updateNodeData: (id: string, data: NodeData) => void,
  config: DurationConfig
) {
  const handleDurationChange = useCallback((value: string) => {
    const days = parseDurationString(value);
    if (days !== null && isValidDuration(days, { maxDays: config.maxDays })) {
      updateNodeData(id, { 
        ...data, 
        [config.fieldName]: days 
      });
    }
  }, [id, data, updateNodeData, config]);

  const handleDurationKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentValue = data[config.fieldName];
    const currentDays = typeof currentValue === 'number' ? currentValue : 0;
    const step = e.shiftKey ? 5 : 1;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newDays = Math.min(currentDays + step, config.maxDays);
      updateNodeData(id, { 
        ...data, 
        [config.fieldName]: newDays 
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newDays = Math.max(currentDays - step, 0);
      updateNodeData(id, { 
        ...data, 
        [config.fieldName]: newDays 
      });
    }
  }, [data, updateNodeData, id, config]);

  const currentValue = data[config.fieldName];
  const durationValue = typeof currentValue === 'number' ? currentValue : 0;

  return {
    handleDurationChange,
    handleDurationKeyDown,
    value: durationValue,
    displayValue: durationValue ? formatDuration(durationValue) : 'days',
    config
  };
} 