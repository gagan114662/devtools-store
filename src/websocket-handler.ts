/**
 * WebSocket Handler with Rate Limiting
 * 
 * Wraps WebSocket message handling with rate limiting protection.
 */

import { RateLimiter, RateLimiterConfig, RateLimitResult, RateLimitPresets } from './rate-limiter';
import { 
  ErrorCodes, 
  createErrorString, 
  formatErrorForLogging,
  CloseCode,
  type ErrorCode 
} from './errors';

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
export function createRateLimitedHandler(
  handler: MessageHandler,
  config: RateLimitedHandlerConfig
): { handler: MessageHandler; rateLimiter: RateLimiter } {
  const rateLimiter = new RateLimiter(config.rateLimit);
  const getClientId = config.getClientId ?? ((client) => client.id);
  const includeSuggestions = config.includeSuggestions ?? true;

  const rateLimitedHandler: MessageHandler = async (client, message) => {
    const clientId = getClientId(client);
    const result = rateLimiter.check(clientId);

    if (!result.allowed) {
      const waitTime = Math.ceil(result.resetMs / 1000);
      client.send(createErrorString(ErrorCodes.RATE_LIMIT_EXCEEDED, {
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
        client.close(CloseCode.RATE_LIMITED, 'Rate limit exceeded');
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
      includeSuggestions: options?.includeSuggestions ?? true,
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
        client.close(CloseCode.RATE_LIMITED, 'Rate limit exceeded');
      }
      
      return;
    }

    // Parse the message
    let message: WebSocketMessage;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      client.send(createErrorString(ErrorCodes.INVALID_JSON, {
        message: 'The message could not be parsed. Please ensure it is valid JSON.',
        includeSuggestion: this.config.includeSuggestions,
        details: { receivedLength: rawMessage.length },
      }));
      return;
    }

    if (!message.type || typeof message.type !== 'string') {
      client.send(createErrorString(ErrorCodes.MISSING_TYPE, {
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
      client.send(createErrorString(ErrorCodes.UNKNOWN_MESSAGE_TYPE, {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the full error for debugging
      console.error(formatErrorForLogging(ErrorCodes.HANDLER_ERROR, {
        clientId,
        messageType: message.type,
        error: error instanceof Error ? error : new Error(String(error)),
      }));

      // Send a sanitized error to the client
      client.send(createErrorString(ErrorCodes.HANDLER_ERROR, {
        message: 'An error occurred while processing your request. Our team has been notified.',
        includeSuggestion: this.config.includeSuggestions,
        details: { messageType: message.type },
      }));
    }
  }

  private sendRateLimitError(client: WebSocketClient, result: RateLimitResult): void {
    const waitTime = Math.ceil(result.resetMs / 1000);
    client.send(createErrorString(ErrorCodes.RATE_LIMIT_EXCEEDED, {
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
export { ErrorCodes, CloseCode, type ErrorCode };
