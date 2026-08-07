import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution: later utilities win, so a
 * component's `className` prop can always override its own defaults.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
