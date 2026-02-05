/**
 * Rate Limiter Module
 * 
 * Implements a sliding window rate limiter for WebSocket connections.
 * Supports configurable limits per client ID with automatic cleanup.
 */

export interface RateLimiterConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: time to block after limit exceeded (ms). If not set, just rejects until window passes */
  blockDurationMs?: number;
}

interface ClientState {
  /** Timestamps of recent requests */
  requests: number[];
  /** If blocked, the timestamp when block expires */
  blockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  blocked?: boolean;
}

export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private clients: Map<string, ClientState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      blockDurationMs: config.blockDurationMs ?? 0,
    };
  }

  /**
   * Check if a request from a client should be allowed
   * @param clientId Unique identifier for the client (e.g., IP, user ID)
   * @returns Result indicating if request is allowed and remaining quota
   */
  check(clientId: string): RateLimitResult {
    const now = Date.now();
    let state = this.clients.get(clientId);

    if (!state) {
      state = { requests: [] };
      this.clients.set(clientId, state);
    }

    // Check if client is blocked
    if (state.blockedUntil && now < state.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: state.blockedUntil - now,
        blocked: true,
      };
    } else if (state.blockedUntil) {
      // Block expired, clear it
      state.blockedUntil = undefined;
      state.requests = [];
    }

    // Clean old requests outside the window
    const windowStart = now - this.config.windowMs;
    state.requests = state.requests.filter(ts => ts > windowStart);

    const remaining = this.config.maxRequests - state.requests.length;
    const oldestRequest = state.requests[0] ?? now;
    const resetMs = Math.max(0, oldestRequest + this.config.windowMs - now);

    if (state.requests.length >= this.config.maxRequests) {
      // Rate limit exceeded
      if (this.config.blockDurationMs > 0) {
        state.blockedUntil = now + this.config.blockDurationMs;
      }
      return {
        allowed: false,
        remaining: 0,
        resetMs: this.config.blockDurationMs > 0 ? this.config.blockDurationMs : resetMs,
        blocked: this.config.blockDurationMs > 0,
      };
    }

    // Allow the request
    state.requests.push(now);
    return {
      allowed: true,
      remaining: remaining - 1,
      resetMs,
    };
  }

  /**
   * Consume a request slot without checking (use after check() returns allowed)
   * Note: check() already consumes, so this is only for manual consumption
   */
  consume(clientId: string): void {
    const state = this.clients.get(clientId);
    if (state) {
      state.requests.push(Date.now());
    }
  }

  /**
   * Reset rate limit state for a specific client
   */
  reset(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Clear all rate limit state
   */
  clear(): void {
    this.clients.clear();
  }

  /**
   * Start automatic cleanup of stale entries
   * @param intervalMs How often to run cleanup (default: windowMs * 2)
   */
  startCleanup(intervalMs?: number): void {
    if (this.cleanupInterval) return;
    
    const interval = intervalMs ?? this.config.windowMs * 2;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Manually run cleanup of stale entries
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [clientId, state] of this.clients.entries()) {
      // Remove requests outside window
      state.requests = state.requests.filter(ts => ts > windowStart);
      
      // Clear expired blocks
      if (state.blockedUntil && now >= state.blockedUntil) {
        state.blockedUntil = undefined;
      }

      // Remove empty entries
      if (state.requests.length === 0 && !state.blockedUntil) {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Get current state for a client (for debugging/monitoring)
   */
  getClientState(clientId: string): { requestCount: number; blocked: boolean; blockedUntil?: number } | null {
    const state = this.clients.get(clientId);
    if (!state) return null;

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const recentRequests = state.requests.filter(ts => ts > windowStart);

    return {
      requestCount: recentRequests.length,
      blocked: !!(state.blockedUntil && now < state.blockedUntil),
      blockedUntil: state.blockedUntil,
    };
  }

  /**
   * Get the number of tracked clients
   */
  get clientCount(): number {
    return this.clients.size;
  }
}

// Default rate limiter configurations
export const RateLimitPresets = {
  /** Strict: 10 requests per 10 seconds, 30s block */
  strict: { maxRequests: 10, windowMs: 10_000, blockDurationMs: 30_000 },
  /** Standard: 30 requests per 10 seconds, no block */
  standard: { maxRequests: 30, windowMs: 10_000 },
  /** Lenient: 100 requests per minute */
  lenient: { maxRequests: 100, windowMs: 60_000 },
  /** Burst: 50 requests per second (for high-throughput) */
  burst: { maxRequests: 50, windowMs: 1_000 },
} as const;
