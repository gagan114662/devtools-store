"use strict";
/**
 * WebSocket Rate Limiter
 *
 * Public API exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitedHandler = exports.RateLimitedWebSocketServer = exports.RateLimitPresets = exports.RateLimiter = void 0;
var rate_limiter_1 = require("./rate-limiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rate_limiter_1.RateLimiter; } });
Object.defineProperty(exports, "RateLimitPresets", { enumerable: true, get: function () { return rate_limiter_1.RateLimitPresets; } });
var websocket_handler_1 = require("./websocket-handler");
Object.defineProperty(exports, "RateLimitedWebSocketServer", { enumerable: true, get: function () { return websocket_handler_1.RateLimitedWebSocketServer; } });
Object.defineProperty(exports, "createRateLimitedHandler", { enumerable: true, get: function () { return websocket_handler_1.createRateLimitedHandler; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUVILCtDQUt3QjtBQUp0QiwyR0FBQSxXQUFXLE9BQUE7QUFHWCxnSEFBQSxnQkFBZ0IsT0FBQTtBQUdsQix5REFPNkI7QUFOM0IsK0hBQUEsMEJBQTBCLE9BQUE7QUFDMUIsNkhBQUEsd0JBQXdCLE9BQUEiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdlYlNvY2tldCBSYXRlIExpbWl0ZXJcbiAqIFxuICogUHVibGljIEFQSSBleHBvcnRzXG4gKi9cblxuZXhwb3J0IHsgXG4gIFJhdGVMaW1pdGVyLCBcbiAgUmF0ZUxpbWl0ZXJDb25maWcsIFxuICBSYXRlTGltaXRSZXN1bHQsXG4gIFJhdGVMaW1pdFByZXNldHMgXG59IGZyb20gJy4vcmF0ZS1saW1pdGVyJztcblxuZXhwb3J0IHtcbiAgUmF0ZUxpbWl0ZWRXZWJTb2NrZXRTZXJ2ZXIsXG4gIGNyZWF0ZVJhdGVMaW1pdGVkSGFuZGxlcixcbiAgV2ViU29ja2V0Q2xpZW50LFxuICBXZWJTb2NrZXRNZXNzYWdlLFxuICBSYXRlTGltaXRlZEhhbmRsZXJDb25maWcsXG4gIE1lc3NhZ2VIYW5kbGVyLFxufSBmcm9tICcuL3dlYnNvY2tldC1oYW5kbGVyJztcbiJdfQ==