/**
 * WebSocket Handler with Rate Limiting
 *
 * Wraps WebSocket message handling with rate limiting protection.
 */
import { RateLimiter, RateLimiterConfig, RateLimitResult, RateLimitPresets } from './rate-limiter';
import { ErrorCodes, CloseCode, type ErrorCode } from './errors';
export interface WebSocketClient {
    id: string;
    send(data: string): void;
    close(code?: number, reason?: string): void;
}
export interface WebSocketMessage {
    type: string;
    payload?: unknown;
}
export interface RateLimitedHandlerConfig {
    /** Rate limiter configuration */
    rateLimit: RateLimiterConfig;
    /** Custom handler for rate limit exceeded (optional) */
    onRateLimitExceeded?: (client: WebSocketClient, result: RateLimitResult) => void;
    /** Whether to close connection on rate limit (default: false) */
    closeOnRateLimit?: boolean;
    /** Custom client ID extractor (default: uses client.id) */
    getClientId?: (client: WebSocketClient) => string;
    /** Include suggestions in error responses (default: true) */
    includeSuggestions?: boolean;
}
export type MessageHandler = (client: WebSocketClient, message: WebSocketMessage) => void | Promise<void>;
/**
 * Creates a rate-limited WebSocket message handler
 */
export declare function createRateLimitedHandler(handler: MessageHandler, config: RateLimitedHandlerConfig): {
    handler: MessageHandler;
    rateLimiter: RateLimiter;
};
/**
 * WebSocket server with built-in rate limiting
 */
export declare class RateLimitedWebSocketServer {
    private rateLimiter;
    private handlers;
    private config;
    constructor(rateLimitConfig?: RateLimiterConfig, options?: Partial<Omit<RateLimitedHandlerConfig, 'rateLimit'>>);
    /**
     * Register a message handler for a specific message type
     */
    on(messageType: string, handler: MessageHandler): void;
    /**
     * Remove a message handler
     */
    off(messageType: string): void;
    /**
     * Handle an incoming message (call this from your WebSocket server's message event)
     */
    handleMessage(client: WebSocketClient, rawMessage: string): Promise<void>;
    private sendRateLimitError;
    /**
     * Get the rate limiter instance for advanced operations
     */
    getRateLimiter(): RateLimiter;
    /**
     * Reset rate limit for a specific client
     */
    resetClient(clientId: string): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
export { RateLimiter, RateLimiterConfig, RateLimitResult, RateLimitPresets };
export { ErrorCodes, CloseCode, type ErrorCode };
