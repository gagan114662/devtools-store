/**
 * WebSocket Handler with Rate Limiting
 * 
 * Wraps WebSocket message handling with rate limiting protection.
 */

import { RateLimiter, RateLimiterConfig, RateLimitResult, RateLimitPresets } from './rate-limiter';

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
}

export type MessageHandler = (client: WebSocketClient, message: WebSocketMessage) => void | Promise<void>;

/**
 * Creates a rate-limited WebSocket message handler
 */
export function createRateLimitedHandler(
  handler: MessageHandler,
  config: RateLimitedHandlerConfig
): { handler: MessageHandler; rateLimiter: RateLimiter } {
  const rateLimiter = new RateLimiter(config.rateLimit);
  const getClientId = config.getClientId ?? ((client) => client.id);

  const rateLimitedHandler: MessageHandler = async (client, message) => {
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
export class RateLimitedWebSocketServer {
  private rateLimiter: RateLimiter;
  private handlers: Map<string, MessageHandler> = new Map();
  private config: Required<Omit<RateLimitedHandlerConfig, 'rateLimit'>>;

  constructor(rateLimitConfig: RateLimiterConfig = RateLimitPresets.standard, options?: Partial<Omit<RateLimitedHandlerConfig, 'rateLimit'>>) {
    this.rateLimiter = new RateLimiter(rateLimitConfig);
    this.config = {
      onRateLimitExceeded: options?.onRateLimitExceeded ?? (() => {}),
      closeOnRateLimit: options?.closeOnRateLimit ?? false,
      getClientId: options?.getClientId ?? ((client) => client.id),
    };
    
    // Start automatic cleanup
    this.rateLimiter.startCleanup();
  }

  /**
   * Register a message handler for a specific message type
   */
  on(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  /**
   * Remove a message handler
   */
  off(messageType: string): void {
    this.handlers.delete(messageType);
  }

  /**
   * Handle an incoming message (call this from your WebSocket server's message event)
   */
  async handleMessage(client: WebSocketClient, rawMessage: string): Promise<void> {
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
    let message: WebSocketMessage;
    try {
      message = JSON.parse(rawMessage);
    } catch {
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
    } catch (error) {
      client.send(JSON.stringify({
        type: 'error',
        code: 'HANDLER_ERROR',
        message: 'Internal server error',
      }));
      console.error(`Handler error for message type "${message.type}":`, error);
    }
  }

  private sendRateLimitError(client: WebSocketClient, result: RateLimitResult): void {
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
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Reset rate limit for a specific client
   */
  resetClient(clientId: string): void {
    this.rateLimiter.reset(clientId);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.rateLimiter.stopCleanup();
    this.rateLimiter.clear();
    this.handlers.clear();
  }
}

// Re-export for convenience
export { RateLimiter, RateLimiterConfig, RateLimitResult, RateLimitPresets };
