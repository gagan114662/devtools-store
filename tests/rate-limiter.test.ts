/**
 * Unit tests for Rate Limiter and WebSocket Handler
 */

import { RateLimiter, RateLimitPresets } from '../src/rate-limiter';
import { RateLimitedWebSocketServer, createRateLimitedHandler, WebSocketClient } from '../src/websocket-handler';

// Mock WebSocket client
function createMockClient(id: string): WebSocketClient & { messages: string[]; closed: boolean; closeCode?: number } {
  const client = {
    id,
    messages: [] as string[],
    closed: false,
    closeCode: undefined as number | undefined,
    send(data: string) {
      this.messages.push(data);
    },
    close(code?: number, _reason?: string) {
      this.closed = true;
      this.closeCode = code;
    },
  };
  return client;
}

// Helper to advance time in tests
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('RateLimiter', () => {
  describe('basic rate limiting', () => {
    it('should allow requests within the limit', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
      
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('client1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should reject requests over the limit', () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
      
      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        limiter.check('client1');
      }

      // Next request should be rejected
      const result = limiter.check('client1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track clients independently', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
      
      // Client 1 uses their quota
      limiter.check('client1');
      limiter.check('client1');
      
      // Client 1 is now rate limited
      expect(limiter.check('client1').allowed).toBe(false);
      
      // Client 2 should still be allowed
      expect(limiter.check('client2').allowed).toBe(true);
    });
  });

  describe('window sliding', () => {
    it('should allow requests after window expires', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 100 });
      
      // Use up quota
      limiter.check('client1');
      limiter.check('client1');
      expect(limiter.check('client1').allowed).toBe(false);

      // Wait for window to pass
      await sleep(150);

      // Should be allowed again
      expect(limiter.check('client1').allowed).toBe(true);
    });
  });

  describe('blocking', () => {
    it('should block client when blockDurationMs is set', () => {
      const limiter = new RateLimiter({ 
        maxRequests: 2, 
        windowMs: 1000,
        blockDurationMs: 5000 
      });
      
      // Exceed limit
      limiter.check('client1');
      limiter.check('client1');
      const result = limiter.check('client1');
      
      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.resetMs).toBeGreaterThan(4000);
    });

    it('should unblock after block duration expires', async () => {
      const limiter = new RateLimiter({ 
        maxRequests: 1, 
        windowMs: 50,
        blockDurationMs: 100 
      });
      
      limiter.check('client1');
      const blocked = limiter.check('client1');
      expect(blocked.blocked).toBe(true);

      // Wait for block to expire
      await sleep(150);

      const result = limiter.check('client1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset and cleanup', () => {
    it('should reset client state', () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
      
      limiter.check('client1');
      expect(limiter.check('client1').allowed).toBe(false);
      
      limiter.reset('client1');
      expect(limiter.check('client1').allowed).toBe(true);
    });

    it('should clear all clients', () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
      
      limiter.check('client1');
      limiter.check('client2');
      expect(limiter.clientCount).toBe(2);
      
      limiter.clear();
      expect(limiter.clientCount).toBe(0);
    });

    it('should cleanup stale entries', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 50 });
      
      limiter.check('client1');
      expect(limiter.clientCount).toBe(1);
      
      await sleep(100);
      limiter.cleanup();
      
      expect(limiter.clientCount).toBe(0);
    });
  });

  describe('client state inspection', () => {
    it('should return null for unknown clients', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
      expect(limiter.getClientState('unknown')).toBeNull();
    });

    it('should return accurate state for known clients', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
      
      limiter.check('client1');
      limiter.check('client1');
      
      const state = limiter.getClientState('client1');
      expect(state).not.toBeNull();
      expect(state!.requestCount).toBe(2);
      expect(state!.blocked).toBe(false);
    });
  });

  describe('presets', () => {
    it('should have valid preset configurations', () => {
      expect(RateLimitPresets.strict.maxRequests).toBe(10);
      expect(RateLimitPresets.strict.blockDurationMs).toBe(30000);
      
      expect(RateLimitPresets.standard.maxRequests).toBe(30);
      expect('blockDurationMs' in RateLimitPresets.standard).toBe(false);
      
      expect(RateLimitPresets.lenient.maxRequests).toBe(100);
      expect(RateLimitPresets.burst.maxRequests).toBe(50);
    });
  });
});

describe('RateLimitedWebSocketServer', () => {
  let server: RateLimitedWebSocketServer;

  beforeEach(() => {
    server = new RateLimitedWebSocketServer({ maxRequests: 5, windowMs: 1000 });
  });

  afterEach(() => {
    server.destroy();
  });

  describe('message handling', () => {
    it('should route messages to registered handlers', async () => {
      const received: any[] = [];
      
      server.on('ping', (client, message) => {
        received.push({ client: client.id, message });
        client.send(JSON.stringify({ type: 'pong' }));
      });

      const client = createMockClient('c1');
      await server.handleMessage(client, JSON.stringify({ type: 'ping', payload: 'test' }));

      expect(received.length).toBe(1);
      expect(received[0].message.type).toBe('ping');
      expect(client.messages).toContain(JSON.stringify({ type: 'pong' }));
    });

    it('should handle unknown message types', async () => {
      const client = createMockClient('c1');
      await server.handleMessage(client, JSON.stringify({ type: 'unknown' }));

      const response = JSON.parse(client.messages[0]);
      expect(response.code).toBe('UNKNOWN_MESSAGE_TYPE');
    });

    it('should handle invalid JSON', async () => {
      const client = createMockClient('c1');
      await server.handleMessage(client, 'not json');

      const response = JSON.parse(client.messages[0]);
      expect(response.code).toBe('INVALID_JSON');
      expect(response.title).toBe('Invalid JSON');
      expect(response.statusCode).toBe(400);
      expect(response.recoverable).toBe(true);
    });

    it('should handle messages without type', async () => {
      const client = createMockClient('c1');
      await server.handleMessage(client, JSON.stringify({ payload: 'test' }));

      const response = JSON.parse(client.messages[0]);
      expect(response.code).toBe('MISSING_TYPE');
      expect(response.title).toBe('Missing Message Type');
      expect(response.suggestion).toBeTruthy();
    });
  });

  describe('rate limiting integration', () => {
    it('should rate limit excessive messages', async () => {
      server.on('test', () => {});
      const client = createMockClient('c1');

      // Send 5 messages (limit)
      for (let i = 0; i < 5; i++) {
        await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      }
      expect(client.messages.length).toBe(0); // No errors yet

      // 6th message should be rate limited
      await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      
      const response = JSON.parse(client.messages[0]);
      expect(response.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should call onRateLimitExceeded callback', async () => {
      const exceeded: any[] = [];
      const serverWithCallback = new RateLimitedWebSocketServer(
        { maxRequests: 1, windowMs: 1000 },
        { onRateLimitExceeded: (client, result) => exceeded.push({ client: client.id, result }) }
      );

      serverWithCallback.on('test', () => {});
      const client = createMockClient('c1');

      await serverWithCallback.handleMessage(client, JSON.stringify({ type: 'test' }));
      await serverWithCallback.handleMessage(client, JSON.stringify({ type: 'test' }));

      expect(exceeded.length).toBe(1);
      expect(exceeded[0].client).toBe('c1');

      serverWithCallback.destroy();
    });

    it('should close connection when closeOnRateLimit is true', async () => {
      const serverWithClose = new RateLimitedWebSocketServer(
        { maxRequests: 1, windowMs: 1000 },
        { closeOnRateLimit: true }
      );

      serverWithClose.on('test', () => {});
      const client = createMockClient('c1');

      await serverWithClose.handleMessage(client, JSON.stringify({ type: 'test' }));
      await serverWithClose.handleMessage(client, JSON.stringify({ type: 'test' }));

      expect(client.closed).toBe(true);
      expect(client.closeCode).toBe(4029);

      serverWithClose.destroy();
    });
  });

  describe('handler management', () => {
    it('should remove handlers with off()', async () => {
      server.on('test', (client) => client.send('handled'));
      const client = createMockClient('c1');
      
      await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      expect(client.messages).toContain('handled');

      server.off('test');
      await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      
      const lastMessage = JSON.parse(client.messages[client.messages.length - 1]);
      expect(lastMessage.code).toBe('UNKNOWN_MESSAGE_TYPE');
    });
  });

  describe('client management', () => {
    it('should reset specific client rate limits', async () => {
      server.on('test', () => {});
      const client = createMockClient('c1');

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      }
      
      // Verify rate limited
      await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      expect(client.messages.length).toBe(1);

      // Reset and try again
      server.resetClient('c1');
      client.messages = [];
      
      await server.handleMessage(client, JSON.stringify({ type: 'test' }));
      expect(client.messages.length).toBe(0); // No error, message processed
    });
  });
});

describe('createRateLimitedHandler', () => {
  it('should wrap a handler with rate limiting', async () => {
    const calls: any[] = [];
    const originalHandler = (client: WebSocketClient, message: any) => {
      calls.push({ client: client.id, message });
    };

    const { handler } = createRateLimitedHandler(originalHandler, {
      rateLimit: { maxRequests: 2, windowMs: 1000 },
    });

    const client = createMockClient('c1');

    // First two calls should work
    await handler(client, { type: 'test', payload: 1 });
    await handler(client, { type: 'test', payload: 2 });
    expect(calls.length).toBe(2);

    // Third call should be rate limited
    await handler(client, { type: 'test', payload: 3 });
    expect(calls.length).toBe(2); // Still 2, handler wasn't called
    
    const response = JSON.parse(client.messages[0]);
    expect(response.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should support custom client ID extraction', async () => {
    const calls: string[] = [];
    const originalHandler = (client: WebSocketClient) => {
      calls.push(client.id);
    };

    const { handler, rateLimiter } = createRateLimitedHandler(originalHandler, {
      rateLimit: { maxRequests: 1, windowMs: 1000 },
      getClientId: (client) => `custom-${client.id}`,
    });

    const client = createMockClient('c1');
    await handler(client, { type: 'test' });
    await handler(client, { type: 'test' });

    // Should be rate limited under custom ID
    expect(rateLimiter.getClientState('custom-c1')).not.toBeNull();
    expect(rateLimiter.getClientState('c1')).toBeNull();
  });
});

// Run tests with: npx jest tests/rate-limiter.test.ts
