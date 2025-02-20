import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ValidationError, ValidationContextType } from '@/types/validation';

// Create the context with a default value
const ValidationContext = createContext<ValidationContextType>({
  addError: () => {},
  clearErrors: () => {},
  getErrors: () => [],
  hasErrors: () => false
});

// Create the provider component
export function ValidationProvider({ children }: { children: ReactNode }) {
  // Store errors by nodeId
  const [errors, setErrors] = useState<Record<string, ValidationError[]>>({});

  const addError = useCallback((nodeId: string, error: ValidationError) => {
    setErrors(current => ({
      ...current,
      [nodeId]: [...(current[nodeId] || []), error]
    }));
  }, []);

  const clearErrors = useCallback((nodeId: string) => {
    setErrors(current => {
      const newErrors = { ...current };
      delete newErrors[nodeId];
      return newErrors;
    });
  }, []);

  const getErrors = useCallback((nodeId: string) => {
    return errors[nodeId] || [];
  }, [errors]);

  const hasErrors = useCallback((nodeId: string) => {
    return (errors[nodeId]?.length || 0) > 0;
  }, [errors]);

  return (
    <ValidationContext.Provider value={{
      addError,
      clearErrors,
      getErrors,
      hasErrors
    }}>
      {children}
    </ValidationContext.Provider>
  );
}

// Create a custom hook for using the validation context
export function useValidation() {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation must be used within a ValidationProvider');
  }
  return context;
} 