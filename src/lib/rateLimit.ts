/**
 * Rate Limiting Utility
 * Vercel-compatible in-memory rate limiter
 * For production, consider using Redis or Vercel's built-in rate limiting
 */

import { NextRequest } from "next/server";
import { env } from "./env";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

// In-memory store (clears on server restart)
// For production with multiple instances, use Redis
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  max: number; // Maximum requests
  window: number; // Time window in milliseconds
  identifier?: (req: NextRequest) => string; // Custom identifier function
}

/**
 * Get client identifier (IP address)
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from headers (Vercel, Cloudflare, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || req.ip || "unknown";

  return ip;
}

/**
 * Check if request should be rate limited
 * @returns { limit: number, remaining: number, reset: number } if allowed
 * @returns null if rate limited
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): { limit: number; remaining: number; reset: number } | null {
  // Skip rate limiting if disabled
  if (!env.RATE_LIMIT_ENABLED) {
    return { limit: config.max, remaining: config.max, reset: Date.now() + config.window };
  }

  const identifier = config.identifier ? config.identifier(req) : getClientIdentifier(req);
  const key = `${identifier}:${config.max}:${config.window}`;
  const now = Date.now();

  // Get or create entry
  let entry = store[key];

  if (!entry || entry.resetAt < now) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + config.window,
    };
    store[key] = entry;
    return {
      limit: config.max,
      remaining: config.max - 1,
      reset: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;

  if (entry.count > config.max) {
    // Rate limited
    return null;
  }

  return {
    limit: config.max,
    remaining: config.max - entry.count,
    reset: entry.resetAt,
  };
}

/**
 * Rate limit middleware for API routes
 * Returns NextResponse with 429 if rate limited
 */
export function withRateLimit(
  config: RateLimitConfig
): (req: NextRequest) => Promise<Response | null> {
  return async (req: NextRequest) => {
    const result = checkRateLimit(req, config);

    if (!result) {
      const resetTime = store[`${getClientIdentifier(req)}:${config.max}:${config.window}`]?.resetAt || Date.now() + config.window;
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(config.max),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(resetTime),
          },
        }
      );
    }

    // Add rate limit headers to response
    // Note: We'll add these in the actual route handler since we can't modify response here
    return null;
  };
}

/**
 * Predefined rate limit configs
 */
export const rateLimitConfigs = {
  // Strict: 5 requests per minute (for login, sensitive operations)
  strict: {
    max: 5,
    window: 60 * 1000, // 1 minute
  },
  // Moderate: 100 requests per minute (for general API)
  moderate: {
    max: 100,
    window: 60 * 1000, // 1 minute
  },
  // Lenient: 1000 requests per hour (for public endpoints)
  lenient: {
    max: 1000,
    window: 60 * 60 * 1000, // 1 hour
  },
};
