/**
 * Error Handling Utilities
 * Prevents stack trace leakage and provides structured error responses
 */

import { NextResponse } from "next/server";
import { env } from "./env";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not Found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too Many Requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
  }
}

/**
 * Redact sensitive information from error messages
 */
function redactSensitiveData(message: string): string {
  // Remove potential secrets, tokens, passwords
  return message
    .replace(/password[=:]\s*[^\s,}]+/gi, "password=***")
    .replace(/token[=:]\s*[^\s,}]+/gi, "token=***")
    .replace(/secret[=:]\s*[^\s,}]+/gi, "secret=***")
    .replace(/authorization[=:]\s*[^\s,}]+/gi, "authorization=***");
}

/**
 * Create safe error response for client
 * Never exposes stack traces or sensitive information in production
 */
export function createErrorResponse(error: unknown): NextResponse {
  // Log full error on server (for debugging)
  if (error instanceof Error) {
    console.error("[ERROR]", {
      name: error.name,
      message: redactSensitiveData(error.message),
      stack: env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } else {
    console.error("[ERROR]", error);
  }

  // Handle known error types
  if (error instanceof AppError) {
    const response: {
      error: string;
      code?: string;
      message: string;
      details?: unknown;
    } = {
      error: error.name,
      message: redactSensitiveData(error.message),
    };

    if (error.code) {
      response.code = error.code;
    }

    // Only include details in development
    if (error.details && env.NODE_ENV === "development") {
      response.details = error.details;
    }

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as { issues: Array<{ path: string[]; message: string }> };
    return NextResponse.json(
      {
        error: "ValidationError",
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: env.NODE_ENV === "development" ? zodError.issues : undefined,
      },
      { status: 400 }
    );
  }

  // Generic error (never expose stack trace)
  return NextResponse.json(
    {
      error: "InternalServerError",
      message: env.NODE_ENV === "development"
        ? error instanceof Error
          ? redactSensitiveData(error.message)
          : "An unexpected error occurred"
        : "An unexpected error occurred. Please try again later.",
    },
    { status: 500 }
  );
}

/**
 * Wrapper for API route handlers with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}
