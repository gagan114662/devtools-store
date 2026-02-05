/**
 * Error Codes and Messages
 * 
 * Centralized error definitions with human-readable descriptions,
 * suggested actions, and HTTP-like status codes for WebSocket errors.
 */

/**
 * Error code definitions with metadata
 */
export interface ErrorDefinition {
  /** The error code (uppercase snake_case) */
  code: string;
  /** HTTP-like status code for categorization */
  statusCode: number;
  /** Short, human-readable title */
  title: string;
  /** Detailed description of what went wrong */
  description: string;
  /** Suggested action for the client to take */
  suggestion: string;
  /** Whether this error is recoverable (client can retry) */
  recoverable: boolean;
}

/**
 * All error codes used by the WebSocket handler
 */
export const ErrorCodes = {
  // Rate Limiting Errors (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Client Errors (400-499)
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_JSON: 'INVALID_JSON',
  MISSING_TYPE: 'MISSING_TYPE',
  UNKNOWN_MESSAGE_TYPE: 'UNKNOWN_MESSAGE_TYPE',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Server Errors (500-599)
  HANDLER_ERROR: 'HANDLER_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Error definitions with full metadata
 */
export const ErrorDefinitions: Record<ErrorCode, ErrorDefinition> = {
  // Rate Limiting
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    statusCode: 429,
    title: 'Rate Limit Exceeded',
    description: 'You have sent too many requests in a short period of time.',
    suggestion: 'Please wait before sending more messages. Check the retryAfterMs field for the recommended wait time.',
    recoverable: true,
  },

  // Client Errors
  [ErrorCodes.INVALID_MESSAGE]: {
    code: ErrorCodes.INVALID_MESSAGE,
    statusCode: 400,
    title: 'Invalid Message',
    description: 'The message format is invalid or malformed.',
    suggestion: 'Ensure your message is valid JSON with a "type" field.',
    recoverable: true,
  },

  [ErrorCodes.INVALID_JSON]: {
    code: ErrorCodes.INVALID_JSON,
    statusCode: 400,
    title: 'Invalid JSON',
    description: 'The message could not be parsed as valid JSON.',
    suggestion: 'Check your JSON syntax. Common issues include missing quotes, trailing commas, or unescaped characters.',
    recoverable: true,
  },

  [ErrorCodes.MISSING_TYPE]: {
    code: ErrorCodes.MISSING_TYPE,
    statusCode: 400,
    title: 'Missing Message Type',
    description: 'The message is missing the required "type" field.',
    suggestion: 'Add a "type" field to your message, e.g., { "type": "ping", "payload": {} }',
    recoverable: true,
  },

  [ErrorCodes.UNKNOWN_MESSAGE_TYPE]: {
    code: ErrorCodes.UNKNOWN_MESSAGE_TYPE,
    statusCode: 404,
    title: 'Unknown Message Type',
    description: 'The server does not recognize this message type.',
    suggestion: 'Check the message type for typos. Refer to the API documentation for supported message types.',
    recoverable: true,
  },

  [ErrorCodes.INVALID_PAYLOAD]: {
    code: ErrorCodes.INVALID_PAYLOAD,
    statusCode: 400,
    title: 'Invalid Payload',
    description: 'The message payload is invalid or missing required fields.',
    suggestion: 'Review the expected payload format for this message type.',
    recoverable: true,
  },

  [ErrorCodes.UNAUTHORIZED]: {
    code: ErrorCodes.UNAUTHORIZED,
    statusCode: 401,
    title: 'Unauthorized',
    description: 'Authentication is required to perform this action.',
    suggestion: 'Provide valid authentication credentials or tokens.',
    recoverable: true,
  },

  [ErrorCodes.FORBIDDEN]: {
    code: ErrorCodes.FORBIDDEN,
    statusCode: 403,
    title: 'Forbidden',
    description: 'You do not have permission to perform this action.',
    suggestion: 'Contact an administrator if you believe you should have access.',
    recoverable: false,
  },

  // Server Errors
  [ErrorCodes.HANDLER_ERROR]: {
    code: ErrorCodes.HANDLER_ERROR,
    statusCode: 500,
    title: 'Handler Error',
    description: 'An error occurred while processing your request.',
    suggestion: 'This is a server-side issue. Please try again later or contact support if the problem persists.',
    recoverable: true,
  },

  [ErrorCodes.INTERNAL_ERROR]: {
    code: ErrorCodes.INTERNAL_ERROR,
    statusCode: 500,
    title: 'Internal Server Error',
    description: 'An unexpected error occurred on the server.',
    suggestion: 'Please try again later. If the problem persists, contact support.',
    recoverable: true,
  },

  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    code: ErrorCodes.SERVICE_UNAVAILABLE,
    statusCode: 503,
    title: 'Service Unavailable',
    description: 'The service is temporarily unavailable.',
    suggestion: 'The server is undergoing maintenance or is overloaded. Please try again later.',
    recoverable: true,
  },
};

/**
 * Structured error response sent to clients
 */
export interface ErrorResponse {
  type: 'error';
  code: ErrorCode;
  statusCode: number;
  title: string;
  message: string;
  suggestion?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
  timestamp: string;
  retryAfterMs?: number;
}

/**
 * Options for creating an error response
 */
export interface CreateErrorOptions {
  /** Override the default message */
  message?: string;
  /** Additional details to include */
  details?: Record<string, unknown>;
  /** For rate limit errors: time until retry is allowed */
  retryAfterMs?: number;
  /** Include suggestion in response (default: true) */
  includeSuggestion?: boolean;
}

/**
 * Create a structured error response
 */
export function createErrorResponse(
  code: ErrorCode,
  options: CreateErrorOptions = {}
): ErrorResponse {
  const definition = ErrorDefinitions[code];
  
  if (!definition) {
    // Fallback for unknown error codes
    return {
      type: 'error',
      code: code,
      statusCode: 500,
      title: 'Unknown Error',
      message: options.message ?? 'An unknown error occurred',
      recoverable: true,
      timestamp: new Date().toISOString(),
      ...(options.details && { details: options.details }),
      ...(options.retryAfterMs && { retryAfterMs: options.retryAfterMs }),
    };
  }

  return {
    type: 'error',
    code: definition.code as ErrorCode,
    statusCode: definition.statusCode,
    title: definition.title,
    message: options.message ?? definition.description,
    ...(options.includeSuggestion !== false && { suggestion: definition.suggestion }),
    recoverable: definition.recoverable,
    timestamp: new Date().toISOString(),
    ...(options.details && { details: options.details }),
    ...(options.retryAfterMs && { retryAfterMs: options.retryAfterMs }),
  };
}

/**
 * Create and stringify an error response (ready to send)
 */
export function createErrorString(
  code: ErrorCode,
  options: CreateErrorOptions = {}
): string {
  return JSON.stringify(createErrorResponse(code, options));
}

/**
 * Get the error definition for a code
 */
export function getErrorDefinition(code: ErrorCode): ErrorDefinition | undefined {
  return ErrorDefinitions[code];
}

/**
 * Check if an error code is recoverable
 */
export function isRecoverable(code: ErrorCode): boolean {
  return ErrorDefinitions[code]?.recoverable ?? true;
}

/**
 * Format an error for logging (includes more detail than client response)
 */
export function formatErrorForLogging(
  code: ErrorCode,
  context: {
    clientId?: string;
    messageType?: string;
    error?: Error;
    details?: Record<string, unknown>;
  }
): string {
  const definition = ErrorDefinitions[code];
  const parts = [
    `[${code}]`,
    definition?.title ?? 'Unknown Error',
  ];

  if (context.clientId) {
    parts.push(`client=${context.clientId}`);
  }

  if (context.messageType) {
    parts.push(`type=${context.messageType}`);
  }

  if (context.error) {
    parts.push(`error=${context.error.message}`);
  }

  if (context.details) {
    parts.push(`details=${JSON.stringify(context.details)}`);
  }

  return parts.join(' | ');
}

/**
 * WebSocket close codes for common error scenarios
 */
export const CloseCode = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  INTERNAL_ERROR: 1011,
  
  // Custom codes (4000-4999 are reserved for applications)
  RATE_LIMITED: 4029,
  UNAUTHORIZED: 4401,
  FORBIDDEN: 4403,
  INVALID_MESSAGE: 4400,
} as const;

export type CloseCodeType = typeof CloseCode[keyof typeof CloseCode];
