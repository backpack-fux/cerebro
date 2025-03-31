import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names or class name objects using clsx and
 * intelligently handles Tailwind CSS class merging/conflicts with twMerge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 