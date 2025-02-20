// Define our validation error type
export interface ValidationError {
  field: string;
  message: string;
  nodeId: string;
}

// Define the shape of our validation context
export interface ValidationContextType {
  addError: (nodeId: string, error: ValidationError) => void;
  clearErrors: (nodeId: string) => void;
  getErrors: (nodeId: string) => ValidationError[];
  hasErrors: (nodeId: string) => boolean;
} 