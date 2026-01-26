import { cookies } from "next/headers";
import { db } from "./db";
import { logger } from "./logger";
import type { User } from "@prisma/client";

const AUTH_COOKIE_NAME = "calendar_auth_user_id";

/**
 * Get current user from cookie (simplified auth for demo)
 * In production, use proper authentication (NextAuth, Clerk, etc.)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // Check if we're in a valid context for cookies() API
    // cookies() can only be called in Server Components, Route Handlers, or Server Actions
    let cookieStore;
    try {
      cookieStore = await cookies();
    } catch (cookieError) {
      const errorMessage = cookieError instanceof Error ? cookieError.message : "Unknown error";
      logger.error("[AUTH] Failed to access cookies() API", {
        error: errorMessage,
        errorType: cookieError instanceof Error ? cookieError.constructor.name : typeof cookieError,
        environment: process.env.VERCEL ? "vercel" : "local",
        stack: cookieError instanceof Error ? cookieError.stack : undefined,
      });
      // If cookies() fails, we can't get user - return null
      return null;
    }

    const userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!userId) {
      // No cookie = not logged in (this is normal, not an error)
      logger.debug("[AUTH] No auth cookie found", {
        cookieName: AUTH_COOKIE_NAME,
      });
      return null;
    }

    logger.debug("[AUTH] Found auth cookie, fetching user", {
      userId: userId.substring(0, 8) + "***", // Partial ID for logs
    });

    // Try to fetch user from database
    let user;
    try {
      user = await db.user.findUnique({
        where: { id: userId },
      });
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : "Unknown error";
      logger.error("[AUTH] Database error while fetching user", {
        error: errorMessage,
        errorType: dbError instanceof Error ? dbError.constructor.name : typeof dbError,
        userId: userId.substring(0, 8) + "***",
        environment: process.env.VERCEL ? "vercel" : "local",
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      // Database error - return null (user not found or DB unavailable)
      return null;
    }

    if (!user) {
      logger.warn("[AUTH] User not found in database", {
        userId: userId.substring(0, 8) + "***",
        message: "Cookie exists but user not found - possible stale cookie",
      });
      return null;
    }

    logger.debug("[AUTH] User found successfully", {
      userId: user.id.substring(0, 8) + "***",
      email: user.email.substring(0, 3) + "***",
      role: user.role,
    });

    return user;
  } catch (error) {
    // Catch any unexpected errors
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error };
    
    logger.error("[AUTH] Unexpected error in getCurrentUser()", {
      ...errorDetails,
      environment: process.env.VERCEL ? "vercel" : "local",
    });
    
    // Return null on any error (fail-safe)
    return null;
  }
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === "ADMIN";
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: No user found");
  }

  if (!isAdmin(user)) {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

/**
 * Require any authenticated user
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: No user found");
  }

  return user;
}
