/**
 * Structured Logging Utility
 * Provides consistent, secure logging with PII redaction
 */

import { env } from "./env";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: unknown;
}

/**
 * Redact sensitive information from log data
 */
function redactSensitiveFields(data: LogContext): LogContext {
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "auth",
    "session",
    "csrf",
  ];

  const redacted = { ...data };

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      redacted[key] = "***REDACTED***";
    } else if (typeof redacted[key] === "object" && redacted[key] !== null) {
      redacted[key] = redactSensitiveFields(redacted[key] as LogContext);
    }
  }

  return redacted;
}

/**
 * Format log entry
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(context && redactSensitiveFields(context)),
  };

  // In development, use pretty JSON
  if (env.NODE_ENV === "development") {
    return JSON.stringify(logEntry, null, 2);
  }

  // In production, use compact JSON (one line)
  return JSON.stringify(logEntry);
}

/**
 * Structured logger
 */
export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(formatLog("info", message, context));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatLog("warn", message, context));
  },

  error: (message: string, context?: LogContext) => {
    console.error(formatLog("error", message, context));
  },

  debug: (message: string, context?: LogContext) => {
    if (env.NODE_ENV === "development") {
      console.debug(formatLog("debug", message, context));
    }
  },
};

/**
 * Security event logger
 * Logs security-related events (failed logins, unauthorized access, etc.)
 */
export const securityLogger = {
  failedLogin: (email: string, ip: string, reason?: string) => {
    logger.warn("Security: Failed login attempt", {
      email: email.substring(0, 3) + "***", // Partial email for identification without full PII
      ip,
      reason: reason || "Invalid credentials",
      event: "failed_login",
    });
  },

  unauthorizedAccess: (userId: string | null, resource: string, ip: string) => {
    logger.warn("Security: Unauthorized access attempt", {
      userId: userId || "anonymous",
      resource,
      ip,
      event: "unauthorized_access",
    });
  },

  rateLimitExceeded: (ip: string, endpoint: string) => {
    logger.warn("Security: Rate limit exceeded", {
      ip,
      endpoint,
      event: "rate_limit_exceeded",
    });
  },

  permissionChanged: (adminUserId: string, targetUserId: string, changes: unknown) => {
    logger.info("Security: Permissions changed", {
      adminUserId,
      targetUserId,
      changes,
      event: "permission_changed",
    });
  },
};
