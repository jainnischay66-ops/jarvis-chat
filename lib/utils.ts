import { clsx, type ClassValue } from 'clsx';

/**
 * Merges class names using clsx.
 */
export function cn(...classes: ClassValue[]): string {
  return clsx(classes);
}

/**
 * Returns a nanoid-style random string using crypto.randomUUID with a Math.random fallback.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Formats a date into a relative time string (e.g. "just now", "2m ago", "1h ago", "yesterday", etc.).
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'yesterday';
  }

  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks}w ago`;
  }

  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months}mo ago`;
  }

  const years = Math.floor(diffInDays / 365);
  return `${years}y ago`;
}

/**
 * Returns "Good morning", "Good afternoon", or "Good evening" based on local time.
 */
export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * Truncates a string to maxLength with an ellipsis appended.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '...';
}

/**
 * Promise-based delay for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounces a function call by a specified delay in milliseconds.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, ms);
  };

  return debounced as unknown as T;
}

/**
 * Boolean check for window existence (client-side execution).
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}
