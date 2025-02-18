import { useCallback } from 'react';

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
  const formatDuration = useCallback((days: number) => {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    const weeks = Math.floor(remainingDays / 5);
    const finalDays = remainingDays % 5;
    
    if (months === 0 && weeks === 0) return `${days} day${days !== 1 ? 's' : ''}`;
    if (months === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}${finalDays > 0 ? ` ${finalDays} day${finalDays !== 1 ? 's' : ''}` : ''}`;
    if (weeks === 0 && finalDays === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    return `${months} month${months !== 1 ? 's' : ''} ${weeks > 0 ? `${weeks} week${weeks !== 1 ? 's' : ''}` : ''}${finalDays > 0 ? ` ${finalDays} day${finalDays !== 1 ? 's' : ''}` : ''}`;
  }, []);

  const handleDurationChange = useCallback((value: string) => {
    const numericValue = value.toLowerCase().replace(/[wm]/, '');
    const isWeeks = value.toLowerCase().includes('w');
    const isMonths = value.toLowerCase().includes('m');
    const number = parseFloat(numericValue);

    if (!isNaN(number)) {
      const days = isMonths 
        ? number * 30 
        : isWeeks 
          ? number * 5 
          : number;
      if (days >= 0 && days <= config.maxDays) {
        updateNodeData(id, { 
          ...data, 
          [config.fieldName]: days 
        });
      }
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
    formatDuration,
    handleDurationChange,
    handleDurationKeyDown,
    value: data[config.fieldName],
    displayValue: data[config.fieldName] ? formatDuration(data[config.fieldName]) : 'days',
    config
  };
} 