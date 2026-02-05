"use strict";
/**
 * WebSocket Handler with Rate Limiting
 *
 * Wraps WebSocket message handling with rate limiting protection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitPresets = exports.RateLimiter = exports.RateLimitedWebSocketServer = void 0;
exports.createRateLimitedHandler = createRateLimitedHandler;
const rate_limiter_1 = require("./rate-limiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rate_limiter_1.RateLimiter; } });
Object.defineProperty(exports, "RateLimitPresets", { enumerable: true, get: function () { return rate_limiter_1.RateLimitPresets; } });
/**
 * Creates a rate-limited WebSocket message handler
 */
function createRateLimitedHandler(handler, config) {
    const rateLimiter = new rate_limiter_1.RateLimiter(config.rateLimit);
    const getClientId = config.getClientId ?? ((client) => client.id);
    const rateLimitedHandler = async (client, message) => {
        const clientId = getClientId(client);
        const result = rateLimiter.check(clientId);
        if (!result.allowed) {
            // Rate limit exceeded
            const errorResponse = {
                type: 'error',
                code: 'RATE_LIMIT_EXCEEDED',
                message: result.blocked
                    ? `Rate limit exceeded. Blocked for ${Math.ceil(result.resetMs / 1000)}s`
                    : `Rate limit exceeded. Try again in ${Math.ceil(result.resetMs / 1000)}s`,
                retryAfterMs: result.resetMs,
            };
            client.send(JSON.stringify(errorResponse));
            if (config.onRateLimitExceeded) {
                config.onRateLimitExceeded(client, result);
            }
            if (config.closeOnRateLimit) {
                client.close(4029, 'Rate limit exceeded');
            }
            return;
        }
        // Process the message normally
        await handler(client, message);
    };
    return { handler: rateLimitedHandler, rateLimiter };
}
/**
 * WebSocket server with built-in rate limiting
 */
class RateLimitedWebSocketServer {
    constructor(rateLimitConfig = rate_limiter_1.RateLimitPresets.standard, options) {
        this.handlers = new Map();
        this.rateLimiter = new rate_limiter_1.RateLimiter(rateLimitConfig);
        this.config = {
            onRateLimitExceeded: options?.onRateLimitExceeded ?? (() => { }),
            closeOnRateLimit: options?.closeOnRateLimit ?? false,
            getClientId: options?.getClientId ?? ((client) => client.id),
        };
        // Start automatic cleanup
        this.rateLimiter.startCleanup();
    }
    /**
     * Register a message handler for a specific message type
     */
    on(messageType, handler) {
        this.handlers.set(messageType, handler);
    }
    /**
     * Remove a message handler
     */
    off(messageType) {
        this.handlers.delete(messageType);
    }
    /**
     * Handle an incoming message (call this from your WebSocket server's message event)
     */
    async handleMessage(client, rawMessage) {
        const clientId = this.config.getClientId(client);
        const result = this.rateLimiter.check(clientId);
        if (!result.allowed) {
            this.sendRateLimitError(client, result);
            if (this.config.onRateLimitExceeded) {
                this.config.onRateLimitExceeded(client, result);
            }
            if (this.config.closeOnRateLimit) {
                client.close(4029, 'Rate limit exceeded');
            }
            return;
        }
        // Parse the message
        let message;
        try {
            message = JSON.parse(rawMessage);
        }
        catch {
            client.send(JSON.stringify({
                type: 'error',
                code: 'INVALID_MESSAGE',
                message: 'Failed to parse message as JSON',
            }));
            return;
        }
        if (!message.type || typeof message.type !== 'string') {
            client.send(JSON.stringify({
                type: 'error',
                code: 'INVALID_MESSAGE',
                message: 'Message must have a "type" field',
            }));
            return;
        }
        // Find and execute the handler
        const handler = this.handlers.get(message.type);
        if (!handler) {
            client.send(JSON.stringify({
                type: 'error',
                code: 'UNKNOWN_MESSAGE_TYPE',
                message: `Unknown message type: ${message.type}`,
            }));
            return;
        }
        try {
            await handler(client, message);
        }
        catch (error) {
            client.send(JSON.stringify({
                type: 'error',
                code: 'HANDLER_ERROR',
                message: 'Internal server error',
            }));
            console.error(`Handler error for message type "${message.type}":`, error);
        }
    }
    sendRateLimitError(client, result) {
        client.send(JSON.stringify({
            type: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            message: result.blocked
                ? `Rate limit exceeded. Blocked for ${Math.ceil(result.resetMs / 1000)}s`
                : `Rate limit exceeded. Try again in ${Math.ceil(result.resetMs / 1000)}s`,
            retryAfterMs: result.resetMs,
            remaining: result.remaining,
        }));
    }
    /**
     * Get the rate limiter instance for advanced operations
     */
    getRateLimiter() {
        return this.rateLimiter;
    }
    /**
     * Reset rate limit for a specific client
     */
    resetClient(clientId) {
        this.rateLimiter.reset(clientId);
    }
    /**
     * Cleanup resources
     */
    destroy() {
        this.rateLimiter.stopCleanup();
        this.rateLimiter.clear();
        this.handlers.clear();
    }
}
exports.RateLimitedWebSocketServer = RateLimitedWebSocketServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vic29ja2V0LWhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvd2Vic29ja2V0LWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQStCSCw0REF3Q0M7QUFyRUQsaURBQW1HO0FBZ04xRiw0RkFoTkEsMEJBQVcsT0FnTkE7QUFBc0MsaUdBaE5BLCtCQUFnQixPQWdOQTtBQXRMMUU7O0dBRUc7QUFDSCxTQUFnQix3QkFBd0IsQ0FDdEMsT0FBdUIsRUFDdkIsTUFBZ0M7SUFFaEMsTUFBTSxXQUFXLEdBQUcsSUFBSSwwQkFBVyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN0RCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVsRSxNQUFNLGtCQUFrQixHQUFtQixLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQ25FLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsc0JBQXNCO1lBQ3RCLE1BQU0sYUFBYSxHQUFHO2dCQUNwQixJQUFJLEVBQUUsT0FBTztnQkFDYixJQUFJLEVBQUUscUJBQXFCO2dCQUMzQixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU87b0JBQ3JCLENBQUMsQ0FBQyxvQ0FBb0MsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHO29CQUN6RSxDQUFDLENBQUMscUNBQXFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRztnQkFDNUUsWUFBWSxFQUFFLE1BQU0sQ0FBQyxPQUFPO2FBQzdCLENBQUM7WUFFRixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUUzQyxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO2dCQUMvQixNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzdDLENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUM1QixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1lBQzVDLENBQUM7WUFFRCxPQUFPO1FBQ1QsQ0FBQztRQUVELCtCQUErQjtRQUMvQixNQUFNLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDO0lBRUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsQ0FBQztBQUN0RCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLDBCQUEwQjtJQUtyQyxZQUFZLGtCQUFxQywrQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsT0FBOEQ7UUFIbEksYUFBUSxHQUFnQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBSXhELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSwwQkFBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixtQkFBbUIsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUM7WUFDL0QsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixJQUFJLEtBQUs7WUFDcEQsV0FBVyxFQUFFLE9BQU8sRUFBRSxXQUFXLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztTQUM3RCxDQUFDO1FBRUYsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsRUFBRSxDQUFDLFdBQW1CLEVBQUUsT0FBdUI7UUFDN0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRDs7T0FFRztJQUNILEdBQUcsQ0FBQyxXQUFtQjtRQUNyQixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQXVCLEVBQUUsVUFBa0I7UUFDN0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXhDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO2dCQUNwQyxJQUFJLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNsRCxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQ2pDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHFCQUFxQixDQUFDLENBQUM7WUFDNUMsQ0FBQztZQUVELE9BQU87UUFDVCxDQUFDO1FBRUQsb0JBQW9CO1FBQ3BCLElBQUksT0FBeUIsQ0FBQztRQUM5QixJQUFJLENBQUM7WUFDSCxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN6QixJQUFJLEVBQUUsT0FBTztnQkFDYixJQUFJLEVBQUUsaUJBQWlCO2dCQUN2QixPQUFPLEVBQUUsaUNBQWlDO2FBQzNDLENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTztRQUNULENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDdEQsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN6QixJQUFJLEVBQUUsT0FBTztnQkFDYixJQUFJLEVBQUUsaUJBQWlCO2dCQUN2QixPQUFPLEVBQUUsa0NBQWtDO2FBQzVDLENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTztRQUNULENBQUM7UUFFRCwrQkFBK0I7UUFDL0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNiLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDekIsSUFBSSxFQUFFLE9BQU87Z0JBQ2IsSUFBSSxFQUFFLHNCQUFzQjtnQkFDNUIsT0FBTyxFQUFFLHlCQUF5QixPQUFPLENBQUMsSUFBSSxFQUFFO2FBQ2pELENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTztRQUNULENBQUM7UUFFRCxJQUFJLENBQUM7WUFDSCxNQUFNLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3pCLElBQUksRUFBRSxPQUFPO2dCQUNiLElBQUksRUFBRSxlQUFlO2dCQUNyQixPQUFPLEVBQUUsdUJBQXVCO2FBQ2pDLENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTyxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsT0FBTyxDQUFDLElBQUksSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVFLENBQUM7SUFDSCxDQUFDO0lBRU8sa0JBQWtCLENBQUMsTUFBdUIsRUFBRSxNQUF1QjtRQUN6RSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDekIsSUFBSSxFQUFFLE9BQU87WUFDYixJQUFJLEVBQUUscUJBQXFCO1lBQzNCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTztnQkFDckIsQ0FBQyxDQUFDLG9DQUFvQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUc7Z0JBQ3pFLENBQUMsQ0FBQyxxQ0FBcUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHO1lBQzVFLFlBQVksRUFBRSxNQUFNLENBQUMsT0FBTztZQUM1QixTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVM7U0FDNUIsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQ7O09BRUc7SUFDSCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRDs7T0FFRztJQUNILFdBQVcsQ0FBQyxRQUFnQjtRQUMxQixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDeEIsQ0FBQztDQUNGO0FBbklELGdFQW1JQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViU29ja2V0IEhhbmRsZXIgd2l0aCBSYXRlIExpbWl0aW5nXG4gKiBcbiAqIFdyYXBzIFdlYlNvY2tldCBtZXNzYWdlIGhhbmRsaW5nIHdpdGggcmF0ZSBsaW1pdGluZyBwcm90ZWN0aW9uLlxuICovXG5cbmltcG9ydCB7IFJhdGVMaW1pdGVyLCBSYXRlTGltaXRlckNvbmZpZywgUmF0ZUxpbWl0UmVzdWx0LCBSYXRlTGltaXRQcmVzZXRzIH0gZnJvbSAnLi9yYXRlLWxpbWl0ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdlYlNvY2tldENsaWVudCB7XG4gIGlkOiBzdHJpbmc7XG4gIHNlbmQoZGF0YTogc3RyaW5nKTogdm9pZDtcbiAgY2xvc2UoY29kZT86IG51bWJlciwgcmVhc29uPzogc3RyaW5nKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWJTb2NrZXRNZXNzYWdlIHtcbiAgdHlwZTogc3RyaW5nO1xuICBwYXlsb2FkPzogdW5rbm93bjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSYXRlTGltaXRlZEhhbmRsZXJDb25maWcge1xuICAvKiogUmF0ZSBsaW1pdGVyIGNvbmZpZ3VyYXRpb24gKi9cbiAgcmF0ZUxpbWl0OiBSYXRlTGltaXRlckNvbmZpZztcbiAgLyoqIEN1c3RvbSBoYW5kbGVyIGZvciByYXRlIGxpbWl0IGV4Y2VlZGVkIChvcHRpb25hbCkgKi9cbiAgb25SYXRlTGltaXRFeGNlZWRlZD86IChjbGllbnQ6IFdlYlNvY2tldENsaWVudCwgcmVzdWx0OiBSYXRlTGltaXRSZXN1bHQpID0+IHZvaWQ7XG4gIC8qKiBXaGV0aGVyIHRvIGNsb3NlIGNvbm5lY3Rpb24gb24gcmF0ZSBsaW1pdCAoZGVmYXVsdDogZmFsc2UpICovXG4gIGNsb3NlT25SYXRlTGltaXQ/OiBib29sZWFuO1xuICAvKiogQ3VzdG9tIGNsaWVudCBJRCBleHRyYWN0b3IgKGRlZmF1bHQ6IHVzZXMgY2xpZW50LmlkKSAqL1xuICBnZXRDbGllbnRJZD86IChjbGllbnQ6IFdlYlNvY2tldENsaWVudCkgPT4gc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBNZXNzYWdlSGFuZGxlciA9IChjbGllbnQ6IFdlYlNvY2tldENsaWVudCwgbWVzc2FnZTogV2ViU29ja2V0TWVzc2FnZSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbi8qKlxuICogQ3JlYXRlcyBhIHJhdGUtbGltaXRlZCBXZWJTb2NrZXQgbWVzc2FnZSBoYW5kbGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSYXRlTGltaXRlZEhhbmRsZXIoXG4gIGhhbmRsZXI6IE1lc3NhZ2VIYW5kbGVyLFxuICBjb25maWc6IFJhdGVMaW1pdGVkSGFuZGxlckNvbmZpZ1xuKTogeyBoYW5kbGVyOiBNZXNzYWdlSGFuZGxlcjsgcmF0ZUxpbWl0ZXI6IFJhdGVMaW1pdGVyIH0ge1xuICBjb25zdCByYXRlTGltaXRlciA9IG5ldyBSYXRlTGltaXRlcihjb25maWcucmF0ZUxpbWl0KTtcbiAgY29uc3QgZ2V0Q2xpZW50SWQgPSBjb25maWcuZ2V0Q2xpZW50SWQgPz8gKChjbGllbnQpID0+IGNsaWVudC5pZCk7XG5cbiAgY29uc3QgcmF0ZUxpbWl0ZWRIYW5kbGVyOiBNZXNzYWdlSGFuZGxlciA9IGFzeW5jIChjbGllbnQsIG1lc3NhZ2UpID0+IHtcbiAgICBjb25zdCBjbGllbnRJZCA9IGdldENsaWVudElkKGNsaWVudCk7XG4gICAgY29uc3QgcmVzdWx0ID0gcmF0ZUxpbWl0ZXIuY2hlY2soY2xpZW50SWQpO1xuXG4gICAgaWYgKCFyZXN1bHQuYWxsb3dlZCkge1xuICAgICAgLy8gUmF0ZSBsaW1pdCBleGNlZWRlZFxuICAgICAgY29uc3QgZXJyb3JSZXNwb25zZSA9IHtcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgY29kZTogJ1JBVEVfTElNSVRfRVhDRUVERUQnLFxuICAgICAgICBtZXNzYWdlOiByZXN1bHQuYmxvY2tlZFxuICAgICAgICAgID8gYFJhdGUgbGltaXQgZXhjZWVkZWQuIEJsb2NrZWQgZm9yICR7TWF0aC5jZWlsKHJlc3VsdC5yZXNldE1zIC8gMTAwMCl9c2BcbiAgICAgICAgICA6IGBSYXRlIGxpbWl0IGV4Y2VlZGVkLiBUcnkgYWdhaW4gaW4gJHtNYXRoLmNlaWwocmVzdWx0LnJlc2V0TXMgLyAxMDAwKX1zYCxcbiAgICAgICAgcmV0cnlBZnRlck1zOiByZXN1bHQucmVzZXRNcyxcbiAgICAgIH07XG5cbiAgICAgIGNsaWVudC5zZW5kKEpTT04uc3RyaW5naWZ5KGVycm9yUmVzcG9uc2UpKTtcblxuICAgICAgaWYgKGNvbmZpZy5vblJhdGVMaW1pdEV4Y2VlZGVkKSB7XG4gICAgICAgIGNvbmZpZy5vblJhdGVMaW1pdEV4Y2VlZGVkKGNsaWVudCwgcmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5jbG9zZU9uUmF0ZUxpbWl0KSB7XG4gICAgICAgIGNsaWVudC5jbG9zZSg0MDI5LCAnUmF0ZSBsaW1pdCBleGNlZWRlZCcpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUHJvY2VzcyB0aGUgbWVzc2FnZSBub3JtYWxseVxuICAgIGF3YWl0IGhhbmRsZXIoY2xpZW50LCBtZXNzYWdlKTtcbiAgfTtcblxuICByZXR1cm4geyBoYW5kbGVyOiByYXRlTGltaXRlZEhhbmRsZXIsIHJhdGVMaW1pdGVyIH07XG59XG5cbi8qKlxuICogV2ViU29ja2V0IHNlcnZlciB3aXRoIGJ1aWx0LWluIHJhdGUgbGltaXRpbmdcbiAqL1xuZXhwb3J0IGNsYXNzIFJhdGVMaW1pdGVkV2ViU29ja2V0U2VydmVyIHtcbiAgcHJpdmF0ZSByYXRlTGltaXRlcjogUmF0ZUxpbWl0ZXI7XG4gIHByaXZhdGUgaGFuZGxlcnM6IE1hcDxzdHJpbmcsIE1lc3NhZ2VIYW5kbGVyPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPE9taXQ8UmF0ZUxpbWl0ZWRIYW5kbGVyQ29uZmlnLCAncmF0ZUxpbWl0Jz4+O1xuXG4gIGNvbnN0cnVjdG9yKHJhdGVMaW1pdENvbmZpZzogUmF0ZUxpbWl0ZXJDb25maWcgPSBSYXRlTGltaXRQcmVzZXRzLnN0YW5kYXJkLCBvcHRpb25zPzogUGFydGlhbDxPbWl0PFJhdGVMaW1pdGVkSGFuZGxlckNvbmZpZywgJ3JhdGVMaW1pdCc+Pikge1xuICAgIHRoaXMucmF0ZUxpbWl0ZXIgPSBuZXcgUmF0ZUxpbWl0ZXIocmF0ZUxpbWl0Q29uZmlnKTtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIG9uUmF0ZUxpbWl0RXhjZWVkZWQ6IG9wdGlvbnM/Lm9uUmF0ZUxpbWl0RXhjZWVkZWQgPz8gKCgpID0+IHt9KSxcbiAgICAgIGNsb3NlT25SYXRlTGltaXQ6IG9wdGlvbnM/LmNsb3NlT25SYXRlTGltaXQgPz8gZmFsc2UsXG4gICAgICBnZXRDbGllbnRJZDogb3B0aW9ucz8uZ2V0Q2xpZW50SWQgPz8gKChjbGllbnQpID0+IGNsaWVudC5pZCksXG4gICAgfTtcbiAgICBcbiAgICAvLyBTdGFydCBhdXRvbWF0aWMgY2xlYW51cFxuICAgIHRoaXMucmF0ZUxpbWl0ZXIuc3RhcnRDbGVhbnVwKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBtZXNzYWdlIGhhbmRsZXIgZm9yIGEgc3BlY2lmaWMgbWVzc2FnZSB0eXBlXG4gICAqL1xuICBvbihtZXNzYWdlVHlwZTogc3RyaW5nLCBoYW5kbGVyOiBNZXNzYWdlSGFuZGxlcik6IHZvaWQge1xuICAgIHRoaXMuaGFuZGxlcnMuc2V0KG1lc3NhZ2VUeXBlLCBoYW5kbGVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBtZXNzYWdlIGhhbmRsZXJcbiAgICovXG4gIG9mZihtZXNzYWdlVHlwZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5oYW5kbGVycy5kZWxldGUobWVzc2FnZVR5cGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhbiBpbmNvbWluZyBtZXNzYWdlIChjYWxsIHRoaXMgZnJvbSB5b3VyIFdlYlNvY2tldCBzZXJ2ZXIncyBtZXNzYWdlIGV2ZW50KVxuICAgKi9cbiAgYXN5bmMgaGFuZGxlTWVzc2FnZShjbGllbnQ6IFdlYlNvY2tldENsaWVudCwgcmF3TWVzc2FnZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY2xpZW50SWQgPSB0aGlzLmNvbmZpZy5nZXRDbGllbnRJZChjbGllbnQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucmF0ZUxpbWl0ZXIuY2hlY2soY2xpZW50SWQpO1xuXG4gICAgaWYgKCFyZXN1bHQuYWxsb3dlZCkge1xuICAgICAgdGhpcy5zZW5kUmF0ZUxpbWl0RXJyb3IoY2xpZW50LCByZXN1bHQpO1xuICAgICAgXG4gICAgICBpZiAodGhpcy5jb25maWcub25SYXRlTGltaXRFeGNlZWRlZCkge1xuICAgICAgICB0aGlzLmNvbmZpZy5vblJhdGVMaW1pdEV4Y2VlZGVkKGNsaWVudCwgcmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuY29uZmlnLmNsb3NlT25SYXRlTGltaXQpIHtcbiAgICAgICAgY2xpZW50LmNsb3NlKDQwMjksICdSYXRlIGxpbWl0IGV4Y2VlZGVkJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB0aGUgbWVzc2FnZVxuICAgIGxldCBtZXNzYWdlOiBXZWJTb2NrZXRNZXNzYWdlO1xuICAgIHRyeSB7XG4gICAgICBtZXNzYWdlID0gSlNPTi5wYXJzZShyYXdNZXNzYWdlKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNsaWVudC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgY29kZTogJ0lOVkFMSURfTUVTU0FHRScsXG4gICAgICAgIG1lc3NhZ2U6ICdGYWlsZWQgdG8gcGFyc2UgbWVzc2FnZSBhcyBKU09OJyxcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIW1lc3NhZ2UudHlwZSB8fCB0eXBlb2YgbWVzc2FnZS50eXBlICE9PSAnc3RyaW5nJykge1xuICAgICAgY2xpZW50LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICBjb2RlOiAnSU5WQUxJRF9NRVNTQUdFJyxcbiAgICAgICAgbWVzc2FnZTogJ01lc3NhZ2UgbXVzdCBoYXZlIGEgXCJ0eXBlXCIgZmllbGQnLFxuICAgICAgfSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEZpbmQgYW5kIGV4ZWN1dGUgdGhlIGhhbmRsZXJcbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5oYW5kbGVycy5nZXQobWVzc2FnZS50eXBlKTtcbiAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgIGNsaWVudC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgY29kZTogJ1VOS05PV05fTUVTU0FHRV9UWVBFJyxcbiAgICAgICAgbWVzc2FnZTogYFVua25vd24gbWVzc2FnZSB0eXBlOiAke21lc3NhZ2UudHlwZX1gLFxuICAgICAgfSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBoYW5kbGVyKGNsaWVudCwgbWVzc2FnZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNsaWVudC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgY29kZTogJ0hBTkRMRVJfRVJST1InLFxuICAgICAgICBtZXNzYWdlOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcbiAgICAgIH0pKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEhhbmRsZXIgZXJyb3IgZm9yIG1lc3NhZ2UgdHlwZSBcIiR7bWVzc2FnZS50eXBlfVwiOmAsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNlbmRSYXRlTGltaXRFcnJvcihjbGllbnQ6IFdlYlNvY2tldENsaWVudCwgcmVzdWx0OiBSYXRlTGltaXRSZXN1bHQpOiB2b2lkIHtcbiAgICBjbGllbnQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgY29kZTogJ1JBVEVfTElNSVRfRVhDRUVERUQnLFxuICAgICAgbWVzc2FnZTogcmVzdWx0LmJsb2NrZWRcbiAgICAgICAgPyBgUmF0ZSBsaW1pdCBleGNlZWRlZC4gQmxvY2tlZCBmb3IgJHtNYXRoLmNlaWwocmVzdWx0LnJlc2V0TXMgLyAxMDAwKX1zYFxuICAgICAgICA6IGBSYXRlIGxpbWl0IGV4Y2VlZGVkLiBUcnkgYWdhaW4gaW4gJHtNYXRoLmNlaWwocmVzdWx0LnJlc2V0TXMgLyAxMDAwKX1zYCxcbiAgICAgIHJldHJ5QWZ0ZXJNczogcmVzdWx0LnJlc2V0TXMsXG4gICAgICByZW1haW5pbmc6IHJlc3VsdC5yZW1haW5pbmcsXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgcmF0ZSBsaW1pdGVyIGluc3RhbmNlIGZvciBhZHZhbmNlZCBvcGVyYXRpb25zXG4gICAqL1xuICBnZXRSYXRlTGltaXRlcigpOiBSYXRlTGltaXRlciB7XG4gICAgcmV0dXJuIHRoaXMucmF0ZUxpbWl0ZXI7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgcmF0ZSBsaW1pdCBmb3IgYSBzcGVjaWZpYyBjbGllbnRcbiAgICovXG4gIHJlc2V0Q2xpZW50KGNsaWVudElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnJhdGVMaW1pdGVyLnJlc2V0KGNsaWVudElkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbnVwIHJlc291cmNlc1xuICAgKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnJhdGVMaW1pdGVyLnN0b3BDbGVhbnVwKCk7XG4gICAgdGhpcy5yYXRlTGltaXRlci5jbGVhcigpO1xuICAgIHRoaXMuaGFuZGxlcnMuY2xlYXIoKTtcbiAgfVxufVxuXG4vLyBSZS1leHBvcnQgZm9yIGNvbnZlbmllbmNlXG5leHBvcnQgeyBSYXRlTGltaXRlciwgUmF0ZUxpbWl0ZXJDb25maWcsIFJhdGVMaW1pdFJlc3VsdCwgUmF0ZUxpbWl0UHJlc2V0cyB9O1xuIl19