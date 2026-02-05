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
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
    blocked?: boolean;
}
export declare class RateLimiter {
    private config;
    private clients;
    private cleanupInterval;
    constructor(config: RateLimiterConfig);
    /**
     * Check if a request from a client should be allowed
     * @param clientId Unique identifier for the client (e.g., IP, user ID)
     * @returns Result indicating if request is allowed and remaining quota
     */
    check(clientId: string): RateLimitResult;
    /**
     * Consume a request slot without checking (use after check() returns allowed)
     * Note: check() already consumes, so this is only for manual consumption
     */
    consume(clientId: string): void;
    /**
     * Reset rate limit state for a specific client
     */
    reset(clientId: string): void;
    /**
     * Clear all rate limit state
     */
    clear(): void;
    /**
     * Start automatic cleanup of stale entries
     * @param intervalMs How often to run cleanup (default: windowMs * 2)
     */
    startCleanup(intervalMs?: number): void;
    /**
     * Stop automatic cleanup
     */
    stopCleanup(): void;
    /**
     * Manually run cleanup of stale entries
     */
    cleanup(): void;
    /**
     * Get current state for a client (for debugging/monitoring)
     */
    getClientState(clientId: string): {
        requestCount: number;
        blocked: boolean;
        blockedUntil?: number;
    } | null;
    /**
     * Get the number of tracked clients
     */
    get clientCount(): number;
}
export declare const RateLimitPresets: {
    /** Strict: 10 requests per 10 seconds, 30s block */
    readonly strict: {
        readonly maxRequests: 10;
        readonly windowMs: 10000;
        readonly blockDurationMs: 30000;
    };
    /** Standard: 30 requests per 10 seconds, no block */
    readonly standard: {
        readonly maxRequests: 30;
        readonly windowMs: 10000;
    };
    /** Lenient: 100 requests per minute */
    readonly lenient: {
        readonly maxRequests: 100;
        readonly windowMs: 60000;
    };
    /** Burst: 50 requests per second (for high-throughput) */
    readonly burst: {
        readonly maxRequests: 50;
        readonly windowMs: 1000;
    };
};
