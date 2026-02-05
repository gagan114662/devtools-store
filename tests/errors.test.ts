/**
 * Unit tests for Error module
 */

import {
  ErrorCodes,
  ErrorDefinitions,
  CloseCode,
  createErrorResponse,
  createErrorString,
  getErrorDefinition,
  isRecoverable,
  formatErrorForLogging,
} from '../src/errors';

describe('ErrorCodes', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ErrorCodes.INVALID_MESSAGE).toBe('INVALID_MESSAGE');
    expect(ErrorCodes.INVALID_JSON).toBe('INVALID_JSON');
    expect(ErrorCodes.MISSING_TYPE).toBe('MISSING_TYPE');
    expect(ErrorCodes.UNKNOWN_MESSAGE_TYPE).toBe('UNKNOWN_MESSAGE_TYPE');
    expect(ErrorCodes.HANDLER_ERROR).toBe('HANDLER_ERROR');
  });
});

describe('ErrorDefinitions', () => {
  it('should have definitions for all error codes', () => {
    for (const code of Object.values(ErrorCodes)) {
      const definition = ErrorDefinitions[code];
      expect(definition).toBeDefined();
      expect(definition.code).toBe(code);
      expect(definition.statusCode).toBeGreaterThanOrEqual(400);
      expect(definition.title).toBeTruthy();
      expect(definition.description).toBeTruthy();
      expect(definition.suggestion).toBeTruthy();
      expect(typeof definition.recoverable).toBe('boolean');
    }
  });

  it('should have appropriate status codes for error categories', () => {
    // Client errors should be 4xx
    expect(ErrorDefinitions.INVALID_MESSAGE.statusCode).toBe(400);
    expect(ErrorDefinitions.INVALID_JSON.statusCode).toBe(400);
    expect(ErrorDefinitions.MISSING_TYPE.statusCode).toBe(400);
    expect(ErrorDefinitions.UNKNOWN_MESSAGE_TYPE.statusCode).toBe(404);
    expect(ErrorDefinitions.UNAUTHORIZED.statusCode).toBe(401);
    expect(ErrorDefinitions.FORBIDDEN.statusCode).toBe(403);
    
    // Rate limiting should be 429
    expect(ErrorDefinitions.RATE_LIMIT_EXCEEDED.statusCode).toBe(429);
    
    // Server errors should be 5xx
    expect(ErrorDefinitions.HANDLER_ERROR.statusCode).toBe(500);
    expect(ErrorDefinitions.INTERNAL_ERROR.statusCode).toBe(500);
    expect(ErrorDefinitions.SERVICE_UNAVAILABLE.statusCode).toBe(503);
  });
});

describe('createErrorResponse', () => {
  it('should create a complete error response', () => {
    const response = createErrorResponse(ErrorCodes.INVALID_JSON);
    
    expect(response.type).toBe('error');
    expect(response.code).toBe('INVALID_JSON');
    expect(response.statusCode).toBe(400);
    expect(response.title).toBe('Invalid JSON');
    expect(response.message).toBeTruthy();
    expect(response.suggestion).toBeTruthy();
    expect(response.recoverable).toBe(true);
    expect(response.timestamp).toBeDefined();
  });

  it('should allow custom messages', () => {
    const response = createErrorResponse(ErrorCodes.INVALID_JSON, {
      message: 'Custom error message',
    });
    
    expect(response.message).toBe('Custom error message');
  });

  it('should include details when provided', () => {
    const response = createErrorResponse(ErrorCodes.INVALID_PAYLOAD, {
      details: { field: 'username', reason: 'required' },
    });
    
    expect(response.details).toEqual({ field: 'username', reason: 'required' });
  });

  it('should include retryAfterMs for rate limit errors', () => {
    const response = createErrorResponse(ErrorCodes.RATE_LIMIT_EXCEEDED, {
      retryAfterMs: 5000,
    });
    
    expect(response.retryAfterMs).toBe(5000);
  });

  it('should exclude suggestion when includeSuggestion is false', () => {
    const response = createErrorResponse(ErrorCodes.INVALID_JSON, {
      includeSuggestion: false,
    });
    
    expect(response.suggestion).toBeUndefined();
  });

  it('should handle unknown error codes gracefully', () => {
    const response = createErrorResponse('UNKNOWN_CODE' as any);
    
    expect(response.code).toBe('UNKNOWN_CODE');
    expect(response.statusCode).toBe(500);
    expect(response.title).toBe('Unknown Error');
  });
});

describe('createErrorString', () => {
  it('should return valid JSON string', () => {
    const errorString = createErrorString(ErrorCodes.INVALID_MESSAGE);
    const parsed = JSON.parse(errorString);
    
    expect(parsed.type).toBe('error');
    expect(parsed.code).toBe('INVALID_MESSAGE');
  });

  it('should include all provided options', () => {
    const errorString = createErrorString(ErrorCodes.RATE_LIMIT_EXCEEDED, {
      message: 'Too fast!',
      retryAfterMs: 10000,
      details: { blocked: true },
    });
    
    const parsed = JSON.parse(errorString);
    expect(parsed.message).toBe('Too fast!');
    expect(parsed.retryAfterMs).toBe(10000);
    expect(parsed.details.blocked).toBe(true);
  });
});

describe('getErrorDefinition', () => {
  it('should return definition for valid code', () => {
    const definition = getErrorDefinition(ErrorCodes.UNAUTHORIZED);
    
    expect(definition).toBeDefined();
    expect(definition?.code).toBe('UNAUTHORIZED');
    expect(definition?.statusCode).toBe(401);
  });

  it('should return undefined for invalid code', () => {
    const definition = getErrorDefinition('NOT_A_REAL_CODE' as any);
    expect(definition).toBeUndefined();
  });
});

describe('isRecoverable', () => {
  it('should return true for recoverable errors', () => {
    expect(isRecoverable(ErrorCodes.RATE_LIMIT_EXCEEDED)).toBe(true);
    expect(isRecoverable(ErrorCodes.INVALID_MESSAGE)).toBe(true);
    expect(isRecoverable(ErrorCodes.HANDLER_ERROR)).toBe(true);
  });

  it('should return false for non-recoverable errors', () => {
    expect(isRecoverable(ErrorCodes.FORBIDDEN)).toBe(false);
  });
});

describe('formatErrorForLogging', () => {
  it('should format error with basic info', () => {
    const log = formatErrorForLogging(ErrorCodes.HANDLER_ERROR, {});
    
    expect(log).toContain('[HANDLER_ERROR]');
    expect(log).toContain('Handler Error');
  });

  it('should include client ID when provided', () => {
    const log = formatErrorForLogging(ErrorCodes.INVALID_JSON, {
      clientId: 'client-123',
    });
    
    expect(log).toContain('client=client-123');
  });

  it('should include message type when provided', () => {
    const log = formatErrorForLogging(ErrorCodes.HANDLER_ERROR, {
      messageType: 'subscribe',
    });
    
    expect(log).toContain('type=subscribe');
  });

  it('should include error message when provided', () => {
    const log = formatErrorForLogging(ErrorCodes.INTERNAL_ERROR, {
      error: new Error('Connection refused'),
    });
    
    expect(log).toContain('error=Connection refused');
  });

  it('should include details when provided', () => {
    const log = formatErrorForLogging(ErrorCodes.INVALID_PAYLOAD, {
      details: { field: 'email' },
    });
    
    expect(log).toContain('"field":"email"');
  });
});

describe('CloseCode', () => {
  it('should have standard WebSocket close codes', () => {
    expect(CloseCode.NORMAL).toBe(1000);
    expect(CloseCode.GOING_AWAY).toBe(1001);
    expect(CloseCode.PROTOCOL_ERROR).toBe(1002);
  });

  it('should have custom application close codes in 4xxx range', () => {
    expect(CloseCode.RATE_LIMITED).toBe(4029);
    expect(CloseCode.UNAUTHORIZED).toBe(4401);
    expect(CloseCode.FORBIDDEN).toBe(4403);
    expect(CloseCode.INVALID_MESSAGE).toBe(4400);
  });
});
