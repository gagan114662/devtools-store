"use strict";
/**
 * WebSocket Handler with Rate Limiting
 *
 * Wraps WebSocket message handling with rate limiting protection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseCode = exports.ErrorCodes = exports.RateLimitPresets = exports.RateLimiter = exports.RateLimitedWebSocketServer = void 0;
exports.createRateLimitedHandler = createRateLimitedHandler;
const rate_limiter_1 = require("./rate-limiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rate_limiter_1.RateLimiter; } });
Object.defineProperty(exports, "RateLimitPresets", { enumerable: true, get: function () { return rate_limiter_1.RateLimitPresets; } });
const errors_1 = require("./errors");
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return errors_1.ErrorCodes; } });
Object.defineProperty(exports, "CloseCode", { enumerable: true, get: function () { return errors_1.CloseCode; } });
/**
 * Creates a rate-limited WebSocket message handler
 */
function createRateLimitedHandler(handler, config) {
    const rateLimiter = new rate_limiter_1.RateLimiter(config.rateLimit);
    const getClientId = config.getClientId ?? ((client) => client.id);
    const includeSuggestions = config.includeSuggestions ?? true;
    const rateLimitedHandler = async (client, message) => {
        const clientId = getClientId(client);
        const result = rateLimiter.check(clientId);
        if (!result.allowed) {
            const waitTime = Math.ceil(result.resetMs / 1000);
            client.send((0, errors_1.createErrorString)(errors_1.ErrorCodes.RATE_LIMIT_EXCEEDED, {
                message: result.blocked
                    ? `You have been temporarily blocked for ${waitTime} seconds due to excessive requests.`
                    : `Too many requests. Please wait ${waitTime} seconds before trying again.`,
                retryAfterMs: result.resetMs,
                includeSuggestion: includeSuggestions,
                details: { blocked: result.blocked, remaining: result.remaining },
            }));
            if (config.onRateLimitExceeded) {
                config.onRateLimitExceeded(client, result);
            }
            if (config.closeOnRateLimit) {
                client.close(errors_1.CloseCode.RATE_LIMITED, 'Rate limit exceeded');
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
            includeSuggestions: options?.includeSuggestions ?? true,
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
                client.close(errors_1.CloseCode.RATE_LIMITED, 'Rate limit exceeded');
            }
            return;
        }
        // Parse the message
        let message;
        try {
            message = JSON.parse(rawMessage);
        }
        catch {
            client.send((0, errors_1.createErrorString)(errors_1.ErrorCodes.INVALID_JSON, {
                message: 'The message could not be parsed. Please ensure it is valid JSON.',
                includeSuggestion: this.config.includeSuggestions,
                details: { receivedLength: rawMessage.length },
            }));
            return;
        }
        if (!message.type || typeof message.type !== 'string') {
            client.send((0, errors_1.createErrorString)(errors_1.ErrorCodes.MISSING_TYPE, {
                message: 'Every message must include a "type" field that specifies the action to perform.',
                includeSuggestion: this.config.includeSuggestions,
                details: { receivedFields: Object.keys(message) },
            }));
            return;
        }
        // Find and execute the handler
        const handler = this.handlers.get(message.type);
        if (!handler) {
            const availableTypes = Array.from(this.handlers.keys());
            client.send((0, errors_1.createErrorString)(errors_1.ErrorCodes.UNKNOWN_MESSAGE_TYPE, {
                message: `The message type "${message.type}" is not recognized.`,
                includeSuggestion: this.config.includeSuggestions,
                details: {
                    receivedType: message.type,
                    availableTypes: availableTypes.length > 0 ? availableTypes : undefined,
                },
            }));
            return;
        }
        try {
            await handler(client, message);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Log the full error for debugging
            console.error((0, errors_1.formatErrorForLogging)(errors_1.ErrorCodes.HANDLER_ERROR, {
                clientId,
                messageType: message.type,
                error: error instanceof Error ? error : new Error(String(error)),
            }));
            // Send a sanitized error to the client
            client.send((0, errors_1.createErrorString)(errors_1.ErrorCodes.HANDLER_ERROR, {
                message: 'An error occurred while processing your request. Our team has been notified.',
                includeSuggestion: this.config.includeSuggestions,
                details: { messageType: message.type },
            }));
        }
    }
    sendRateLimitError(client, result) {
        const waitTime = Math.ceil(result.resetMs / 1000);
        client.send((0, errors_1.createErrorString)(errors_1.ErrorCodes.RATE_LIMIT_EXCEEDED, {
            message: result.blocked
                ? `You have been temporarily blocked for ${waitTime} seconds due to excessive requests.`
                : `Too many requests. Please wait ${waitTime} seconds before trying again.`,
            retryAfterMs: result.resetMs,
            includeSuggestion: this.config.includeSuggestions,
            details: {
                blocked: result.blocked,
                remaining: result.remaining,
                waitSeconds: waitTime,
            },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vic29ja2V0LWhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvd2Vic29ja2V0LWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQXdDSCw0REF1Q0M7QUE3RUQsaURBQW1HO0FBME8xRiw0RkExT0EsMEJBQVcsT0EwT0E7QUFBc0MsaUdBMU9BLCtCQUFnQixPQTBPQTtBQXpPMUUscUNBTWtCO0FBb09ULDJGQXpPUCxtQkFBVSxPQXlPTztBQUFFLDBGQXRPbkIsa0JBQVMsT0FzT21CO0FBeE05Qjs7R0FFRztBQUNILFNBQWdCLHdCQUF3QixDQUN0QyxPQUF1QixFQUN2QixNQUFnQztJQUVoQyxNQUFNLFdBQVcsR0FBRyxJQUFJLDBCQUFXLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3RELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixJQUFJLElBQUksQ0FBQztJQUU3RCxNQUFNLGtCQUFrQixHQUFtQixLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQ25FLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBQSwwQkFBaUIsRUFBQyxtQkFBVSxDQUFDLG1CQUFtQixFQUFFO2dCQUM1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LFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3hCLENBQUM7Q0FDRjtBQXJKRCxnRUFxSkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdlYlNvY2tldCBIYW5kbGVyIHdpdGggUmF0ZSBMaW1pdGluZ1xuICogXG4gKiBXcmFwcyBXZWJTb2NrZXQgbWVzc2FnZSBoYW5kbGluZyB3aXRoIHJhdGUgbGltaXRpbmcgcHJvdGVjdGlvbi5cbiAqL1xuXG5pbXBvcnQgeyBSYXRlTGltaXRlciwgUmF0ZUxpbWl0ZXJDb25maWcsIFJhdGVMaW1pdFJlc3VsdCwgUmF0ZUxpbWl0UHJlc2V0cyB9IGZyb20gJy4vcmF0ZS1saW1pdGVyJztcbmltcG9ydCB7IFxuICBFcnJvckNvZGVzLCBcbiAgY3JlYXRlRXJyb3JTdHJpbmcsIFxuICBmb3JtYXRFcnJvckZvckxvZ2dpbmcsXG4gIENsb3NlQ29kZSxcbiAgdHlwZSBFcnJvckNvZGUgXG59IGZyb20gJy4vZXJyb3JzJztcblxuZXhwb3J0IGludGVyZmFjZSBXZWJTb2NrZXRDbGllbnQge1xuICBpZDogc3RyaW5nO1xuICBzZW5kKGRhdGE6IHN0cmluZyk6IHZvaWQ7XG4gIGNsb3NlKGNvZGU/OiBudW1iZXIsIHJlYXNvbj86IHN0cmluZyk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2ViU29ja2V0TWVzc2FnZSB7XG4gIHR5cGU6IHN0cmluZztcbiAgcGF5bG9hZD86IHVua25vd247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmF0ZUxpbWl0ZWRIYW5kbGVyQ29uZmlnIHtcbiAgLyoqIFJhdGUgbGltaXRlciBjb25maWd1cmF0aW9uICovXG4gIHJhdGVMaW1pdDogUmF0ZUxpbWl0ZXJDb25maWc7XG4gIC8qKiBDdXN0b20gaGFuZGxlciBmb3IgcmF0ZSBsaW1pdCBleGNlZWRlZCAob3B0aW9uYWwpICovXG4gIG9uUmF0ZUxpbWl0RXhjZWVkZWQ/OiAoY2xpZW50OiBXZWJTb2NrZXRDbGllbnQsIHJlc3VsdDogUmF0ZUxpbWl0UmVzdWx0KSA9PiB2b2lkO1xuICAvKiogV2hldGhlciB0byBjbG9zZSBjb25uZWN0aW9uIG9uIHJhdGUgbGltaXQgKGRlZmF1bHQ6IGZhbHNlKSAqL1xuICBjbG9zZU9uUmF0ZUxpbWl0PzogYm9vbGVhbjtcbiAgLyoqIEN1c3RvbSBjbGllbnQgSUQgZXh0cmFjdG9yIChkZWZhdWx0OiB1c2VzIGNsaWVudC5pZCkgKi9cbiAgZ2V0Q2xpZW50SWQ/OiAoY2xpZW50OiBXZWJTb2NrZXRDbGllbnQpID0+IHN0cmluZztcbiAgLyoqIEluY2x1ZGUgc3VnZ2VzdGlvbnMgaW4gZXJyb3IgcmVzcG9uc2VzIChkZWZhdWx0OiB0cnVlKSAqL1xuICBpbmNsdWRlU3VnZ2VzdGlvbnM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBNZXNzYWdlSGFuZGxlciA9IChjbGllbnQ6IFdlYlNvY2tldENsaWVudCwgbWVzc2FnZTogV2ViU29ja2V0TWVzc2FnZSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbi8qKlxuICogQ3JlYXRlcyBhIHJhdGUtbGltaXRlZCBXZWJTb2NrZXQgbWVzc2FnZSBoYW5kbGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSYXRlTGltaXRlZEhhbmRsZXIoXG4gIGhhbmRsZXI6IE1lc3NhZ2VIYW5kbGVyLFxuICBjb25maWc6IFJhdGVMaW1pdGVkSGFuZGxlckNvbmZpZ1xuKTogeyBoYW5kbGVyOiBNZXNzYWdlSGFuZGxlcjsgcmF0ZUxpbWl0ZXI6IFJhdGVMaW1pdGVyIH0ge1xuICBjb25zdCByYXRlTGltaXRlciA9IG5ldyBSYXRlTGltaXRlcihjb25maWcucmF0ZUxpbWl0KTtcbiAgY29uc3QgZ2V0Q2xpZW50SWQgPSBjb25maWcuZ2V0Q2xpZW50SWQgPz8gKChjbGllbnQpID0+IGNsaWVudC5pZCk7XG4gIGNvbnN0IGluY2x1ZGVTdWdnZXN0aW9ucyA9IGNvbmZpZy5pbmNsdWRlU3VnZ2VzdGlvbnMgPz8gdHJ1ZTtcblxuICBjb25zdCByYXRlTGltaXRlZEhhbmRsZXI6IE1lc3NhZ2VIYW5kbGVyID0gYXN5bmMgKGNsaWVudCwgbWVzc2FnZSkgPT4ge1xuICAgIGNvbnN0IGNsaWVudElkID0gZ2V0Q2xpZW50SWQoY2xpZW50KTtcbiAgICBjb25zdCByZXN1bHQgPSByYXRlTGltaXRlci5jaGVjayhjbGllbnRJZCk7XG5cbiAgICBpZiAoIXJlc3VsdC5hbGxvd2VkKSB7XG4gICAgICBjb25zdCB3YWl0VGltZSA9IE1hdGguY2VpbChyZXN1bHQucmVzZXRNcyAvIDEwMDApO1xuICAgICAgY2xpZW50LnNlbmQoY3JlYXRlRXJyb3JTdHJpbmcoRXJyb3JDb2Rlcy5SQVRFX0xJTUlUX0VYQ0VFREVELCB7XG4gICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5ibG9ja2VkXG4gICAgICAgICAgPyBgWW91IGhhdmUgYmVlbiB0ZW1wb3JhcmlseSBibG9ja2VkIGZvciAke3dhaXRUaW1lfSBzZWNvbmRzIGR1ZSB0byBleGNlc3NpdmUgcmVxdWVzdHMuYFxuICAgICAgICAgIDogYFRvbyBtYW55IHJlcXVlc3RzLiBQbGVhc2Ugd2FpdCAke3dhaXRUaW1lfSBzZWNvbmRzIGJlZm9yZSB0cnlpbmcgYWdhaW4uYCxcbiAgICAgICAgcmV0cnlBZnRlck1zOiByZXN1bHQucmVzZXRNcyxcbiAgICAgICAgaW5jbHVkZVN1Z2dlc3Rpb246IGluY2x1ZGVTdWdnZXN0aW9ucyxcbiAgICAgICAgZGV0YWlsczogeyBibG9ja2VkOiByZXN1bHQuYmxvY2tlZCwgcmVtYWluaW5nOiByZXN1bHQucmVtYWluaW5nIH0sXG4gICAgICB9KSk7XG5cbiAgICAgIGlmIChjb25maWcub25SYXRlTGltaXRFeGNlZWRlZCkge1xuICAgICAgICBjb25maWcub25SYXRlTGltaXRFeGNlZWRlZChjbGllbnQsIHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcuY2xvc2VPblJhdGVMaW1pdCkge1xuICAgICAgICBjbGllbnQuY2xvc2UoQ2xvc2VDb2RlLlJBVEVfTElNSVRFRCwgJ1JhdGUgbGltaXQgZXhjZWVkZWQnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFByb2Nlc3MgdGhlIG1lc3NhZ2Ugbm9ybWFsbHlcbiAgICBhd2FpdCBoYW5kbGVyKGNsaWVudCwgbWVzc2FnZSk7XG4gIH07XG5cbiAgcmV0dXJuIHsgaGFuZGxlcjogcmF0ZUxpbWl0ZWRIYW5kbGVyLCByYXRlTGltaXRlciB9O1xufVxuXG4vKipcbiAqIFdlYlNvY2tldCBzZXJ2ZXIgd2l0aCBidWlsdC1pbiByYXRlIGxpbWl0aW5nXG4gKi9cbmV4cG9ydCBjbGFzcyBSYXRlTGltaXRlZFdlYlNvY2tldFNlcnZlciB7XG4gIHByaXZhdGUgcmF0ZUxpbWl0ZXI6IFJhdGVMaW1pdGVyO1xuICBwcml2YXRlIGhhbmRsZXJzOiBNYXA8c3RyaW5nLCBNZXNzYWdlSGFuZGxlcj4gPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxPbWl0PFJhdGVMaW1pdGVkSGFuZGxlckNvbmZpZywgJ3JhdGVMaW1pdCc+PjtcblxuICBjb25zdHJ1Y3RvcihyYXRlTGltaXRDb25maWc6IFJhdGVMaW1pdGVyQ29uZmlnID0gUmF0ZUxpbWl0UHJlc2V0cy5zdGFuZGFyZCwgb3B0aW9ucz86IFBhcnRpYWw8T21pdDxSYXRlTGltaXRlZEhhbmRsZXJDb25maWcsICdyYXRlTGltaXQnPj4pIHtcbiAgICB0aGlzLnJhdGVMaW1pdGVyID0gbmV3IFJhdGVMaW1pdGVyKHJhdGVMaW1pdENvbmZpZyk7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBvblJhdGVMaW1pdEV4Y2VlZGVkOiBvcHRpb25zPy5vblJhdGVMaW1pdEV4Y2VlZGVkID8/ICgoKSA9PiB7fSksXG4gICAgICBjbG9zZU9uUmF0ZUxpbWl0OiBvcHRpb25zPy5jbG9zZU9uUmF0ZUxpbWl0ID8/IGZhbHNlLFxuICAgICAgZ2V0Q2xpZW50SWQ6IG9wdGlvbnM/LmdldENsaWVudElkID8/ICgoY2xpZW50KSA9PiBjbGllbnQuaWQpLFxuICAgICAgaW5jbHVkZVN1Z2dlc3Rpb25zOiBvcHRpb25zPy5pbmNsdWRlU3VnZ2VzdGlvbnMgPz8gdHJ1ZSxcbiAgICB9O1xuICAgIFxuICAgIC8vIFN0YXJ0IGF1dG9tYXRpYyBjbGVhbnVwXG4gICAgdGhpcy5yYXRlTGltaXRlci5zdGFydENsZWFudXAoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIG1lc3NhZ2UgaGFuZGxlciBmb3IgYSBzcGVjaWZpYyBtZXNzYWdlIHR5cGVcbiAgICovXG4gIG9uKG1lc3NhZ2VUeXBlOiBzdHJpbmcsIGhhbmRsZXI6IE1lc3NhZ2VIYW5kbGVyKTogdm9pZCB7XG4gICAgdGhpcy5oYW5kbGVycy5zZXQobWVzc2FnZVR5cGUsIGhhbmRsZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIG1lc3NhZ2UgaGFuZGxlclxuICAgKi9cbiAgb2ZmKG1lc3NhZ2VUeXBlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmhhbmRsZXJzLmRlbGV0ZShtZXNzYWdlVHlwZSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGFuIGluY29taW5nIG1lc3NhZ2UgKGNhbGwgdGhpcyBmcm9tIHlvdXIgV2ViU29ja2V0IHNlcnZlcidzIG1lc3NhZ2UgZXZlbnQpXG4gICAqL1xuICBhc3luYyBoYW5kbGVNZXNzYWdlKGNsaWVudDogV2ViU29ja2V0Q2xpZW50LCByYXdNZXNzYWdlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjbGllbnRJZCA9IHRoaXMuY29uZmlnLmdldENsaWVudElkKGNsaWVudCk7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5yYXRlTGltaXRlci5jaGVjayhjbGllbnRJZCk7XG5cbiAgICBpZiAoIXJlc3VsdC5hbGxvd2VkKSB7XG4gICAgICB0aGlzLnNlbmRSYXRlTGltaXRFcnJvcihjbGllbnQsIHJlc3VsdCk7XG4gICAgICBcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5vblJhdGVMaW1pdEV4Y2VlZGVkKSB7XG4gICAgICAgIHRoaXMuY29uZmlnLm9uUmF0ZUxpbWl0RXhjZWVkZWQoY2xpZW50LCByZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5jb25maWcuY2xvc2VPblJhdGVMaW1pdCkge1xuICAgICAgICBjbGllbnQuY2xvc2UoQ2xvc2VDb2RlLlJBVEVfTElNSVRFRCwgJ1JhdGUgbGltaXQgZXhjZWVkZWQnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHRoZSBtZXNzYWdlXG4gICAgbGV0IG1lc3NhZ2U6IFdlYlNvY2tldE1lc3NhZ2U7XG4gICAgdHJ5IHtcbiAgICAgIG1lc3NhZ2UgPSBKU09OLnBhcnNlKHJhd01lc3NhZ2UpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY2xpZW50LnNlbmQoY3JlYXRlRXJyb3JTdHJpbmcoRXJyb3JDb2Rlcy5JTlZBTElEX0pTT04sIHtcbiAgICAgICAgbWVzc2FnZTogJ1RoZSBtZXNzYWdlIGNvdWxkIG5vdCBiZSBwYXJzZWQuIFBsZWFzZSBlbnN1cmUgaXQgaXMgdmFsaWQgSlNPTi4nLFxuICAgICAgICBpbmNsdWRlU3VnZ2VzdGlvbjogdGhpcy5jb25maWcuaW5jbHVkZVN1Z2dlc3Rpb25zLFxuICAgICAgICBkZXRhaWxzOiB7IHJlY2VpdmVkTGVuZ3RoOiByYXdNZXNzYWdlLmxlbmd0aCB9LFxuICAgICAgfSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghbWVzc2FnZS50eXBlIHx8IHR5cGVvZiBtZXNzYWdlLnR5cGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICBjbGllbnQuc2VuZChjcmVhdGVFcnJvclN0cmluZyhFcnJvckNvZGVzLk1JU1NJTkdfVFlQRSwge1xuICAgICAgICBtZXNzYWdlOiAnRXZlcnkgbWVzc2FnZSBtdXN0IGluY2x1ZGUgYSBcInR5cGVcIiBmaWVsZCB0aGF0IHNwZWNpZmllcyB0aGUgYWN0aW9uIHRvIHBlcmZvcm0uJyxcbiAgICAgICAgaW5jbHVkZVN1Z2dlc3Rpb246IHRoaXMuY29uZmlnLmluY2x1ZGVTdWdnZXN0aW9ucyxcbiAgICAgICAgZGV0YWlsczogeyByZWNlaXZlZEZpZWxkczogT2JqZWN0LmtleXMobWVzc2FnZSkgfSxcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBGaW5kIGFuZCBleGVjdXRlIHRoZSBoYW5kbGVyXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMuaGFuZGxlcnMuZ2V0KG1lc3NhZ2UudHlwZSk7XG4gICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICBjb25zdCBhdmFpbGFibGVUeXBlcyA9IEFycmF5LmZyb20odGhpcy5oYW5kbGVycy5rZXlzKCkpO1xuICAgICAgY2xpZW50LnNlbmQoY3JlYXRlRXJyb3JTdHJpbmcoRXJyb3JDb2Rlcy5VTktOT1dOX01FU1NBR0VfVFlQRSwge1xuICAgICAgICBtZXNzYWdlOiBgVGhlIG1lc3NhZ2UgdHlwZSBcIiR7bWVzc2FnZS50eXBlfVwiIGlzIG5vdCByZWNvZ25pemVkLmAsXG4gICAgICAgIGluY2x1ZGVTdWdnZXN0aW9uOiB0aGlzLmNvbmZpZy5pbmNsdWRlU3VnZ2VzdGlvbnMsXG4gICAgICAgIGRldGFpbHM6IHsgXG4gICAgICAgICAgcmVjZWl2ZWRUeXBlOiBtZXNzYWdlLnR5cGUsXG4gICAgICAgICAgYXZhaWxhYmxlVHlwZXM6IGF2YWlsYWJsZVR5cGVzLmxlbmd0aCA+IDAgPyBhdmFpbGFibGVUeXBlcyA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSxcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgaGFuZGxlcihjbGllbnQsIG1lc3NhZ2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJztcbiAgICAgIFxuICAgICAgLy8gTG9nIHRoZSBmdWxsIGVycm9yIGZvciBkZWJ1Z2dpbmdcbiAgICAgIGNvbnNvbGUuZXJyb3IoZm9ybWF0RXJyb3JGb3JMb2dnaW5nKEVycm9yQ29kZXMuSEFORExFUl9FUlJPUiwge1xuICAgICAgICBjbGllbnRJZCxcbiAgICAgICAgbWVzc2FnZVR5cGU6IG1lc3NhZ2UudHlwZSxcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKSxcbiAgICAgIH0pKTtcblxuICAgICAgLy8gU2VuZCBhIHNhbml0aXplZCBlcnJvciB0byB0aGUgY2xpZW50XG4gICAgICBjbGllbnQuc2VuZChjcmVhdGVFcnJvclN0cmluZyhFcnJvckNvZGVzLkhBTkRMRVJfRVJST1IsIHtcbiAgICAgICAgbWVzc2FnZTogJ0FuIGVycm9yIG9jY3VycmVkIHdoaWxlIHByb2Nlc3NpbmcgeW91ciByZXF1ZXN0LiBPdXIgdGVhbSBoYXMgYmVlbiBub3RpZmllZC4nLFxuICAgICAgICBpbmNsdWRlU3VnZ2VzdGlvbjogdGhpcy5jb25maWcuaW5jbHVkZVN1Z2dlc3Rpb25zLFxuICAgICAgICBkZXRhaWxzOiB7IG1lc3NhZ2VUeXBlOiBtZXNzYWdlLnR5cGUgfSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNlbmRSYXRlTGltaXRFcnJvcihjbGllbnQ6IFdlYlNvY2tldENsaWVudCwgcmVzdWx0OiBSYXRlTGltaXRSZXN1bHQpOiB2b2lkIHtcbiAgICBjb25zdCB3YWl0VGltZSA9IE1hdGguY2VpbChyZXN1bHQucmVzZXRNcyAvIDEwMDApO1xuICAgIGNsaWVudC5zZW5kKGNyZWF0ZUVycm9yU3RyaW5nKEVycm9yQ29kZXMuUkFURV9MSU1JVF9FWENFRURFRCwge1xuICAgICAgbWVzc2FnZTogcmVzdWx0LmJsb2NrZWRcbiAgICAgICAgPyBgWW91IGhhdmUgYmVlbiB0ZW1wb3JhcmlseSBibG9ja2VkIGZvciAke3dhaXRUaW1lfSBzZWNvbmRzIGR1ZSB0byBleGNlc3NpdmUgcmVxdWVzdHMuYFxuICAgICAgICA6IGBUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHdhaXQgJHt3YWl0VGltZX0gc2Vjb25kcyBiZWZvcmUgdHJ5aW5nIGFnYWluLmAsXG4gICAgICByZXRyeUFmdGVyTXM6IHJlc3VsdC5yZXNldE1zLFxuICAgICAgaW5jbHVkZVN1Z2dlc3Rpb246IHRoaXMuY29uZmlnLmluY2x1ZGVTdWdnZXN0aW9ucyxcbiAgICAgIGRldGFpbHM6IHsgXG4gICAgICAgIGJsb2NrZWQ6IHJlc3VsdC5ibG9ja2VkLCBcbiAgICAgICAgcmVtYWluaW5nOiByZXN1bHQucmVtYWluaW5nLFxuICAgICAgICB3YWl0U2Vjb25kczogd2FpdFRpbWUsXG4gICAgICB9LFxuICAgIH0pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHJhdGUgbGltaXRlciBpbnN0YW5jZSBmb3IgYWR2YW5jZWQgb3BlcmF0aW9uc1xuICAgKi9cbiAgZ2V0UmF0ZUxpbWl0ZXIoKTogUmF0ZUxpbWl0ZXIge1xuICAgIHJldHVybiB0aGlzLnJhdGVMaW1pdGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHJhdGUgbGltaXQgZm9yIGEgc3BlY2lmaWMgY2xpZW50XG4gICAqL1xuICByZXNldENsaWVudChjbGllbnRJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5yYXRlTGltaXRlci5yZXNldChjbGllbnRJZCk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYW51cCByZXNvdXJjZXNcbiAgICovXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5yYXRlTGltaXRlci5zdG9wQ2xlYW51cCgpO1xuICAgIHRoaXMucmF0ZUxpbWl0ZXIuY2xlYXIoKTtcbiAgICB0aGlzLmhhbmRsZXJzLmNsZWFyKCk7XG4gIH1cbn1cblxuLy8gUmUtZXhwb3J0IGZvciBjb252ZW5pZW5jZVxuZXhwb3J0IHsgUmF0ZUxpbWl0ZXIsIFJhdGVMaW1pdGVyQ29uZmlnLCBSYXRlTGltaXRSZXN1bHQsIFJhdGVMaW1pdFByZXNldHMgfTtcbmV4cG9ydCB7IEVycm9yQ29kZXMsIENsb3NlQ29kZSwgdHlwZSBFcnJvckNvZGUgfTtcbiJdfQ==