import { useCallback } from 'react';
import { formatDuration, parseDurationString, isValidDuration } from '@/utils/time/duration';

export type DurationConfig = {
  maxDays: number;
  label: string;
  fieldName: string;
  tip?: string;
};

export function useDurationInput(
  id: string, 
  data: Record<string, any>,
  updateNodeData: (id: string, data: any) => void,
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
    const currentDays = data[config.fieldName] || 0;
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

  return {
    handleDurationChange,
    handleDurationKeyDown,
    value: data[config.fieldName],
    displayValue: data[config.fieldName] ? formatDuration(data[config.fieldName]) : 'days',
    config
  };
} 