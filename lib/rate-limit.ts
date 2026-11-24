/**
 * Simple in-memory token bucket rate limiter for API routes.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * TokenBucket implementation for rate limiting.
 * Tokens accumulate over time up to capacity at a fixed refill rate.
 */
export class TokenBucket {
  public readonly capacity: number;
  public readonly refillRate: number; // Tokens added per second
  public tokens: number;
  public lastRefill: number; // Timestamp in milliseconds

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Refills the bucket based on elapsed time since the last refill.
   */
  public refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    if (elapsedSeconds > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRate);
      this.lastRefill = now;
    }
  }

  /**
   * Attempts to consume the specified number of tokens (defaults to 1).
   * Returns true if tokens were successfully consumed, or false if insufficient tokens were available.
   */
  public consume(tokens: number = 1): boolean {
    if (tokens <= 0) {
      return true;
    }
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * Calculates the wait time in seconds until the requested number of tokens (default 1) is available.
   */
  public getRetryAfter(tokens: number = 1): number {
    this.refill();
    if (this.tokens >= tokens) {
      return 0;
    }
    const needed = tokens - this.tokens;
    return Math.max(1, Math.ceil(needed / this.refillRate));
  }

  /**
   * Resets the bucket to full capacity and resets the refill timestamp.
   */
  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}

/**
 * Singleton rateLimiter instance with capacity 20, refill 1 token per second.
 */
export const rateLimiter = new TokenBucket(20, 1);

interface BucketEntry {
  bucket: TokenBucket;
  lastAccessed: number;
}

const DEFAULT_CAPACITY = 20;
const DEFAULT_REFILL_RATE = 1; // 1 token per second
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ENTRY_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory map storing rate limit token buckets per IP/identifier.
 */
export const ipBuckets = new Map<string, BucketEntry>();

/**
 * Clean up old entries from the map that have been inactive for more than 5 minutes.
 */
export function cleanupOldEntries(): void {
  const now = Date.now();
  ipBuckets.forEach((entry, key) => {
    if (now - entry.lastAccessed >= ENTRY_TTL_MS) {
      ipBuckets.delete(key);
    }
  });
}

// Periodically clean up old entries (every 5 minutes)
const cleanupTimer = setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Check if a request for the given identifier is allowed under the rate limit.
 * Tracks per-IP buckets in a Map and returns allowed status and retryAfter in seconds if rate limited.
 */
export function checkRateLimit(identifier: string): RateLimitResult {
  const id = identifier || 'unknown';
  const now = Date.now();
  let entry = ipBuckets.get(id);

  if (!entry) {
    entry = {
      bucket: new TokenBucket(DEFAULT_CAPACITY, DEFAULT_REFILL_RATE),
      lastAccessed: now,
    };
    ipBuckets.set(id, entry);
  } else {
    entry.lastAccessed = now;
  }

  const allowed = entry.bucket.consume(1);
  if (allowed) {
    return { allowed: true };
  }

  const retryAfter = entry.bucket.getRetryAfter(1);
  return {
    allowed: false,
    retryAfter,
  };
}

/**
 * Reset rate limit entries for a specific identifier, or clear all entries if no identifier is passed.
 */
export function resetRateLimits(identifier?: string): void {
  if (identifier) {
    ipBuckets.delete(identifier);
  } else {
    ipBuckets.clear();
  }
}
