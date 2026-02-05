"use strict";
/**
 * WebSocket Rate Limiter
 *
 * Public API exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatErrorForLogging = exports.isRecoverable = exports.getErrorDefinition = exports.createErrorString = exports.createErrorResponse = exports.CloseCode = exports.ErrorDefinitions = exports.ErrorCodes = exports.createRateLimitedHandler = exports.RateLimitedWebSocketServer = exports.RateLimitPresets = exports.RateLimiter = void 0;
var rate_limiter_1 = require("./rate-limiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rate_limiter_1.RateLimiter; } });
Object.defineProperty(exports, "RateLimitPresets", { enumerable: true, get: function () { return rate_limiter_1.RateLimitPresets; } });
var websocket_handler_1 = require("./websocket-handler");
Object.defineProperty(exports, "RateLimitedWebSocketServer", { enumerable: true, get: function () { return websocket_handler_1.RateLimitedWebSocketServer; } });
Object.defineProperty(exports, "createRateLimitedHandler", { enumerable: true, get: function () { return websocket_handler_1.createRateLimitedHandler; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return errors_1.ErrorCodes; } });
Object.defineProperty(exports, "ErrorDefinitions", { enumerable: true, get: function () { return errors_1.ErrorDefinitions; } });
Object.defineProperty(exports, "CloseCode", { enumerable: true, get: function () { return errors_1.CloseCode; } });
Object.defineProperty(exports, "createErrorResponse", { enumerable: true, get: function () { return errors_1.createErrorResponse; } });
Object.defineProperty(exports, "createErrorString", { enumerable: true, get: function () { return errors_1.createErrorString; } });
Object.defineProperty(exports, "getErrorDefinition", { enumerable: true, get: function () { return errors_1.getErrorDefinition; } });
Object.defineProperty(exports, "isRecoverable", { enumerable: true, get: function () { return errors_1.isRecoverable; } });
Object.defineProperty(exports, "formatErrorForLogging", { enumerable: true, get: function () { return errors_1.formatErrorForLogging; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUVILCtDQUt3QjtBQUp0QiwyR0FBQSxXQUFXLE9BQUE7QUFHWCxnSEFBQSxnQkFBZ0IsT0FBQTtBQUdsQix5REFPNkI7QUFOM0IsK0hBQUEsMEJBQTBCLE9BQUE7QUFDMUIsNkhBQUEsd0JBQXdCLE9BQUE7QUFPMUIsbUNBY2tCO0FBYmhCLG9HQUFBLFVBQVUsT0FBQTtBQUNWLDBHQUFBLGdCQUFnQixPQUFBO0FBQ2hCLG1HQUFBLFNBQVMsT0FBQTtBQUNULDZHQUFBLG1CQUFtQixPQUFBO0FBQ25CLDJHQUFBLGlCQUFpQixPQUFBO0FBQ2pCLDRHQUFBLGtCQUFrQixPQUFBO0FBQ2xCLHVHQUFBLGFBQWEsT0FBQTtBQUNiLCtHQUFBLHFCQUFxQixPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBXZWJTb2NrZXQgUmF0ZSBMaW1pdGVyXG4gKiBcbiAqIFB1YmxpYyBBUEkgZXhwb3J0c1xuICovXG5cbmV4cG9ydCB7IFxuICBSYXRlTGltaXRlciwgXG4gIFJhdGVMaW1pdGVyQ29uZmlnLCBcbiAgUmF0ZUxpbWl0UmVzdWx0LFxuICBSYXRlTGltaXRQcmVzZXRzIFxufSBmcm9tICcuL3JhdGUtbGltaXRlcic7XG5cbmV4cG9ydCB7XG4gIFJhdGVMaW1pdGVkV2ViU29ja2V0U2VydmVyLFxuICBjcmVhdGVSYXRlTGltaXRlZEhhbmRsZXIsXG4gIFdlYlNvY2tldENsaWVudCxcbiAgV2ViU29ja2V0TWVzc2FnZSxcbiAgUmF0ZUxpbWl0ZWRIYW5kbGVyQ29uZmlnLFxuICBNZXNzYWdlSGFuZGxlcixcbn0gZnJvbSAnLi93ZWJzb2NrZXQtaGFuZGxlcic7XG5cbmV4cG9ydCB7XG4gIEVycm9yQ29kZXMsXG4gIEVycm9yRGVmaW5pdGlvbnMsXG4gIENsb3NlQ29kZSxcbiAgY3JlYXRlRXJyb3JSZXNwb25zZSxcbiAgY3JlYXRlRXJyb3JTdHJpbmcsXG4gIGdldEVycm9yRGVmaW5pdGlvbixcbiAgaXNSZWNvdmVyYWJsZSxcbiAgZm9ybWF0RXJyb3JGb3JMb2dnaW5nLFxuICB0eXBlIEVycm9yQ29kZSxcbiAgdHlwZSBFcnJvckRlZmluaXRpb24sXG4gIHR5cGUgRXJyb3JSZXNwb25zZSxcbiAgdHlwZSBDcmVhdGVFcnJvck9wdGlvbnMsXG4gIHR5cGUgQ2xvc2VDb2RlVHlwZSxcbn0gZnJvbSAnLi9lcnJvcnMnO1xuIl19