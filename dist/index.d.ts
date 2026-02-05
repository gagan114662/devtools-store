/**
 * WebSocket Rate Limiter
 *
 * Public API exports
 */
export { RateLimiter, RateLimiterConfig, RateLimitResult, RateLimitPresets } from './rate-limiter';
export { RateLimitedWebSocketServer, createRateLimitedHandler, WebSocketClient, WebSocketMessage, RateLimitedHandlerConfig, MessageHandler, } from './websocket-handler';
export { ErrorCodes, ErrorDefinitions, CloseCode, createErrorResponse, createErrorString, getErrorDefinition, isRecoverable, formatErrorForLogging, type ErrorCode, type ErrorDefinition, type ErrorResponse, type CreateErrorOptions, type CloseCodeType, } from './errors';
