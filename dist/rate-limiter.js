"use strict";
/**
 * Rate Limiter Module
 *
 * Implements a sliding window rate limiter for WebSocket connections.
 * Supports configurable limits per client ID with automatic cleanup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitPresets = exports.RateLimiter = void 0;
class RateLimiter {
    constructor(config) {
        this.clients = new Map();
        this.cleanupInterval = null;
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
    check(clientId) {
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
        }
        else if (state.blockedUntil) {
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
    consume(clientId) {
        const state = this.clients.get(clientId);
        if (state) {
            state.requests.push(Date.now());
        }
    }
    /**
     * Reset rate limit state for a specific client
     */
    reset(clientId) {
        this.clients.delete(clientId);
    }
    /**
     * Clear all rate limit state
     */
    clear() {
        this.clients.clear();
    }
    /**
     * Start automatic cleanup of stale entries
     * @param intervalMs How often to run cleanup (default: windowMs * 2)
     */
    startCleanup(intervalMs) {
        if (this.cleanupInterval)
            return;
        const interval = intervalMs ?? this.config.windowMs * 2;
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, interval);
    }
    /**
     * Stop automatic cleanup
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    /**
     * Manually run cleanup of stale entries
     */
    cleanup() {
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
    getClientState(clientId) {
        const state = this.clients.get(clientId);
        if (!state)
            return null;
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
    get clientCount() {
        return this.clients.size;
    }
}
exports.RateLimiter = RateLimiter;
// Default rate limiter configurations
exports.RateLimitPresets = {
    /** Strict: 10 requests per 10 seconds, 30s block */
    strict: { maxRequests: 10, windowMs: 10000, blockDurationMs: 30000 },
    /** Standard: 30 requests per 10 seconds, no block */
    standard: { maxRequests: 30, windowMs: 10000 },
    /** Lenient: 100 requests per minute */
    lenient: { maxRequests: 100, windowMs: 60000 },
    /** Burst: 50 requests per second (for high-throughput) */
    burst: { maxRequests: 50, windowMs: 1000 },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF0ZS1saW1pdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3JhdGUtbGltaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7OztBQXlCSCxNQUFhLFdBQVc7SUFLdEIsWUFBWSxNQUF5QjtRQUg3QixZQUFPLEdBQTZCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDOUMsb0JBQWUsR0FBMEIsSUFBSSxDQUFDO1FBR3BELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7WUFDL0IsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1lBQ3pCLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxJQUFJLENBQUM7U0FDN0MsQ0FBQztJQUNKLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLFFBQWdCO1FBQ3BCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV2QyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWCxLQUFLLEdBQUcsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFFRCw2QkFBNkI7UUFDN0IsSUFBSSxLQUFLLENBQUMsWUFBWSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkQsT0FBTztnQkFDTCxPQUFPLEVBQUUsS0FBSztnQkFDZCxTQUFTLEVBQUUsQ0FBQztnQkFDWixPQUFPLEVBQUUsS0FBSyxDQUFDLFlBQVksR0FBRyxHQUFHO2dCQUNqQyxPQUFPLEVBQUUsSUFBSTthQUNkLENBQUM7UUFDSixDQUFDO2FBQU0sSUFBSSxLQUFL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KiBcbiAqIEltcGxlbWVudHMgYSBzbGlkaW5nIHdpbmRvdyByYXRlIGxpbWl0ZXIgZm9yIFdlYlNvY2tldCBjb25uZWN0aW9ucy5cbiAqIFN1cHBvcnRzIGNvbmZpZ3VyYWJsZSBsaW1pdHMgcGVyIGNsaWVudCBJRCB3aXRoIGF1dG9tYXRpYyBjbGVhbnVwLlxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgUmF0ZUxpbWl0ZXJDb25maWcge1xuICAvKiogTWF4aW11bSBudW1iZXIgb2YgcmVxdWVzdHMgYWxsb3dlZCB3aXRoaW4gdGhlIHdpbmRvdyAqL1xuICBtYXhSZXF1ZXN0czogbnVtYmVyO1xuICAvKiogVGltZSB3aW5kb3cgaW4gbWlsbGlzZWNvbmRzICovXG4gIHdpbmRvd01zOiBudW1iZXI7XG4gIC8qKiBPcHRpb25hbDogdGltZSB0byBibG9jayBhZnRlciBsaW1pdCBleGNlZWRlZCAobXMpLiBJZiBub3Qgc2V0LCBqdXN0IHJlamVjdHMgdW50aWwgd2luZG93IHBhc3NlcyAqL1xuICBibG9ja0R1cmF0aW9uTXM/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBDbGllbnRTdGF0ZSB7XG4gIC8qKiBUaW1lc3RhbXBzIG9mIHJlY2VudCByZXF1ZXN0cyAqL1xuICByZXF1ZXN0czogbnVtYmVyW107XG4gIC8qKiBJZiBibG9ja2VkLCB0aGUgdGltZXN0YW1wIHdoZW4gYmxvY2sgZXhwaXJlcyAqL1xuICBibG9ja2VkVW50aWw/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmF0ZUxpbWl0UmVzdWx0IHtcbiAgYWxsb3dlZDogYm9vbGVhbjtcbiAgcmVtYWluaW5nOiBudW1iZXI7XG4gIHJlc2V0TXM6IG51bWJlcjtcbiAgYmxvY2tlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBSYXRlTGltaXRlciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxSYXRlTGltaXRlckNvbmZpZz47XG4gIHByaXZhdGUgY2xpZW50czogTWFwPHN0cmluZywgQ2xpZW50U3RhdGU+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIGNsZWFudXBJbnRlcnZhbDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFJhdGVMaW1pdGVyQ29uZmlnKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtYXhSZXF1ZXN0czogY29uZmlnLm1heFJlcXVlc3RzLFxuICAgICAgd2luZG93TXM6IGNvbmZpZy53aW5kb3dNcyxcbiAgICAgIGJsb2NrRHVyYXRpb25NczogY29uZmlnLmJsb2NrRHVyYXRpb25NcyA/PyAwLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYSByZXF1ZXN0IGZyb20gYSBjbGllbnQgc2hvdWxkIGJlIGFsbG93ZWRcbiAgICogQHBhcmFtIGNsaWVudElkIFVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgY2xpZW50IChlLmcuLCBJUCwgdXNlciBJRClcbiAgICogQHJldHVybnMgUmVzdWx0IGluZGljYXRpbmcgaWYgcmVxdWVzdCBpcyBhbGxvd2VkIGFuZCByZW1haW5pbmcgcXVvdGFcbiAgICovXG4gIGNoZWNrKGNsaWVudElkOiBzdHJpbmcpOiBSYXRlTGltaXRSZXN1bHQge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgbGV0IHN0YXRlID0gdGhpcy5jbGllbnRzLmdldChjbGllbnRJZCk7XG5cbiAgICBpZiAoIXN0YXRlKSB7XG4gICAgICBzdGF0ZSA9IHsgcmVxdWVzdHM6IFtdIH07XG4gICAgICB0aGlzLmNsaWVudHMuc2V0KGNsaWVudElkLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgY2xpZW50IGlzIGJsb2NrZWRcbiAgICBpZiAoc3RhdGUuYmxvY2tlZFVudGlsICYmIG5vdyA8IHN0YXRlLmJsb2NrZWRVbnRpbCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICAgIHJlbWFpbmluZzogMCxcbiAgICAgICAgcmVzZXRNczogc3RhdGUuYmxvY2tlZFVudGlsIC0gbm93LFxuICAgICAgICBibG9ja2VkOiB0cnVlLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlLmJsb2NrZWRVbnRpbCkge1xuICAgICAgLy8gQmxvY2sgZXhwaXJlZCwgY2xlYXIgaXRcbiAgICAgIHN0YXRlLmJsb2NrZWRVbnRpbCA9IHVuZGVmaW5lZDtcbiAgICAgIHN0YXRlLnJlcXVlc3RzID0gW107XG4gICAgfVxuXG4gICAgLy8gQ2xlYW4gb2xkIHJlcXVlc3RzIG91dHNpZGUgdGhlIHdpbmRvd1xuICAgIGNvbnN0IHdpbmRvd1N0YXJ0ID0gbm93IC0gdGhpcy5jb25maWcud2luZG93TXM7XG4gICAgc3RhdGUucmVxdWVzdHMgPSBzdGF0ZS5yZXF1ZXN0cy5maWx0ZXIodHMgPT4gdHMgPiB3aW5kb3dTdGFydCk7XG5cbiAgICBjb25zdCByZW1haW5pbmcgPSB0aGlzLmNvbmZpZy5tYXhSZXF1ZXN0cyAtIHN0YXRlLnJlcXVlc3RzLmxlbmd0aDtcbiAgICBjb25zdCBvbGRlc3RSZXF1ZXN0ID0gc3RhdGUucmVxdWVzdHNbMF0gPz8gbm93O1xuICAgIGNvbnN0IHJlc2V0TXMgPSBNYXRoLm1heCgwLCBvbGRlc3RSZXF1ZXN0ICsgdGhpcy5jb25maWcud2luZG93TXMgLSBub3cpO1xuXG4gICAgaWYgKHN0YXRlLnJlcXVlc3RzLmxlbmd0aCA+PSB0aGlzLmNvbmZpZy5tYXhSZXF1ZXN0cykge1xuICAgICAgLy8gUmF0ZSBsaW1pdCBleGNlZWRlZFxuICAgICAgaWYgKHRoaXMuY29uZmlnLmJsb2NrRHVyYXRpb25NcyA+IDApIHtcbiAgICAgICAgc3RhdGUuYmxvY2tlZFVudGlsID0gbm93ICsgdGhpcy5jb25maWcuYmxvY2tEdXJhdGlvbk1zO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICAgIHJlbWFpbmluZzogMCxcbiAgICAgICAgcmVzZXRNczogdGhpcy5jb25maWcuYmxvY2tEdXJhdGlvbk1zID4gMCA/IHRoaXMuY29uZmlnLmJsb2NrRHVyYXRpb25NcyA6IHJlc2V0TXMsXG4gICAgICAgIGJsb2NrZWQ6IHRoaXMuY29uZmlnLmJsb2NrRHVyYXRpb25NcyA+IDAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEFsbG93IHRoZSByZXF1ZXN0XG4gICAgc3RhdGUucmVxdWVzdHMucHVzaChub3cpO1xuICAgIHJldHVybiB7XG4gICAgICBhbGxvd2VkOiB0cnVlLFxuICAgICAgcmVtYWluaW5nOiByZW1haW5pbmcgLSAxLFxuICAgICAgcmVzZXRNcyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN1bWUgYSByZXF1ZXN0IHNsb3Qgd2l0aG91dCBjaGVja2luZyAodXNlIGFmdGVyIGNoZWNrKCkgcmV0dXJucyBhbGxvd2VkKVxuICAgKiBOb3RlOiBjaGVjaygpIGFscmVhZHkgY29uc3VtZXMsIHNvIHRoaXMgaXMgb25seSBmb3IgbWFudWFsIGNvbnN1bXB0aW9uXG4gICAqL1xuICBjb25zdW1lKGNsaWVudElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuY2xpZW50cy5nZXQoY2xpZW50SWQpO1xuICAgIGlmIChzdGF0ZSkge1xuICAgICAgc3RhdGUucmVxdWVzdHMucHVzaChEYXRlLm5vdygpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgcmF0ZSBsaW1pdCBzdGF0ZSBmb3IgYSBzcGVjaWZpYyBjbGllbnRcbiAgICovXG4gIHJlc2V0KGNsaWVudElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmNsaWVudHMuZGVsZXRlKGNsaWVudElkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhciBhbGwgcmF0ZSBsaW1pdCBzdGF0ZVxuICAgKi9cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5jbGllbnRzLmNsZWFyKCk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYXV0b21hdGljIGNsZWFudXAgb2Ygc3RhbGUgZW50cmllc1xuICAgKiBAcGFyYW0gaW50ZXJ2YWxNcyBIb3cgb2Z0ZW4gdG8gcnVuIGNsZWFudXAgKGRlZmF1bHQ6IHdpbmRvd01zICogMilcbiAgICovXG4gIHN0YXJ0Q2xlYW51cChpbnRlcnZhbE1zPzogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY2xlYW51cEludGVydmFsKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBpbnRlcnZhbE1zID8/IHRoaXMuY29uZmlnLndpbmRvd01zICogMjtcbiAgICB0aGlzLmNsZWFudXBJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMuY2xlYW51cCgpO1xuICAgIH0sIGludGVydmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wIGF1dG9tYXRpYyBjbGVhbnVwXG4gICAqL1xuICBzdG9wQ2xlYW51cCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jbGVhbnVwSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5jbGVhbnVwSW50ZXJ2YWwpO1xuICAgICAgdGhpcy5jbGVhbnVwSW50ZXJ2YWwgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNYW51YWxseSBydW4gY2xlYW51cCBvZiBzdGFsZSBlbnRyaWVzXG4gICAqL1xuICBjbGVhbnVwKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3Qgd2luZG93U3RhcnQgPSBub3cgLSB0aGlzLmNvbmZpZy53aW5kb3dNcztcblxuICAgIGZvciAoY29uc3QgW2NsaWVudElkLCBzdGF0ZV0gb2YgdGhpcy5jbGllbnRzLmVudHJpZXMoKSkge1xuICAgICAgLy8gUmVtb3ZlIHJlcXVlc3RzIG91dHNpZGUgd2luZG93XG4gICAgICBzdGF0ZS5yZXF1ZXN0cyA9IHN0YXRlLnJlcXVlc3RzLmZpbHRlcih0cyA9PiB0cyA+IHdpbmRvd1N0YXJ0KTtcbiAgICAgIFxuICAgICAgLy8gQ2xlYXIgZXhwaXJlZCBibG9ja3NcbiAgICAgIGlmIChzdGF0ZS5ibG9ja2VkVW50aWwgJiYgbm93ID49IHN0YXRlLmJsb2NrZWRVbnRpbCkge1xuICAgICAgICBzdGF0ZS5ibG9ja2VkVW50aWwgPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW92ZSBlbXB0eSBlbnRyaWVzXG4gICAgICBpZiAoc3RhdGUucmVxdWVzdHMubGVuZ3RoID09PSAwICYmICFzdGF0ZS5ibG9ja2VkVW50aWwpIHtcbiAgICAgICAgdGhpcy5jbGllbnRzLmRlbGV0ZShjbGllbnRJZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IHN0YXRlIGZvciBhIGNsaWVudCAoZm9yIGRlYnVnZ2luZy9tb25pdG9yaW5nKVxuICAgKi9cbiAgZ2V0Q2xpZW50U3RhdGUoY2xpZW50SWQ6IHN0cmluZyk6IHsgcmVxdWVzdENvdW50OiBudW1iZXI7IGJsb2NrZWQ6IGJvb2xlYW47IGJsb2NrZWRVbnRpbD86IG51bWJlciB9IHwgbnVsbCB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLmNsaWVudHMuZ2V0KGNsaWVudElkKTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3Qgd2luZG93U3RhcnQgPSBub3cgLSB0aGlzLmNvbmZpZy53aW5kb3dNcztcbiAgICBjb25zdCByZWNlbnRSZXF1ZXN0cyA9IHN0YXRlLnJlcXVlc3RzLmZpbHRlcih0cyA9PiB0cyA+IHdpbmRvd1N0YXJ0KTtcblxuICAgIHJldHVybiB7XG4gICAgICByZXF1ZXN0Q291bnQ6IHJlY2VudFJlcXVlc3RzLmxlbmd0aCxcbiAgICAgIGJsb2NrZWQ6ICEhKHN0YXRlLmJsb2NrZWRVbnRpbCAmJiBub3cgPCBzdGF0ZS5ibG9ja2VkVW50aWwpLFxuICAgICAgYmxvY2tlZFVudGlsOiBzdGF0ZS5ibG9ja2VkVW50aWwsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIG51bWJlciBvZiB0cmFja2VkIGNsaWVudHNcbiAgICovXG4gIGdldCBjbGllbnRDb3VudCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmNsaWVudHMuc2l6ZTtcbiAgfVxufVxuXG4vLyBEZWZhdWx0IHJhdGUgbGltaXRlciBjb25maWd1cmF0aW9uc1xuZXhwb3J0IGNvbnN0IFJhdGVMaW1pdFByZXNldHMgPSB7XG4gIC8qKiBTdHJpY3Q6IDEwIHJlcXVlc3RzIHBlciAxMCBzZWNvbmRzLCAzMHMgYmxvY2sgKi9cbiAgc3RyaWN0OiB7IG1heFJlcXVlc3RzOiAxMCwgd2luZG93TXM6IDEwXzAwMCwgYmxvY2tEdXJhdGlvbk1zOiAzMF8wMDAgfSxcbiAgLyoqIFN0YW5kYXJkOiAzMCByZXF1ZXN0cyBwZXIgMTAgc2Vjb25kcywgbm8gYmxvY2sgKi9cbiAgc3RhbmRhcmQ6IHsgbWF4UmVxdWVzdHM6IDMwLCB3aW5kb3dNczogMTBfMDAwIH0sXG4gIC8qKiBMZW5pZW50OiAxMDAgcmVxdWVzdHMgcGVyIG1pbnV0ZSAqL1xuICBsZW5pZW50OiB7IG1heFJlcXVlc3RzOiAxMDAsIHdpbmRvd01zOiA2MF8wMDAgfSxcbiAgLyoqIEJ1cnN0OiA1MCByZXF1ZXN0cyBwZXIgc2Vjb25kIChmb3IgaGlnaC10aHJvdWdocHV0KSAqL1xuICBidXJzdDogeyBtYXhSZXF1ZXN0czogNTAsIHdpbmRvd01zOiAxXzAwMCB9LFxufSBhcyBjb25zdDtcbiJdfQ==