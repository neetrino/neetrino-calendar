import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { checkDatabaseConnection, isDatabaseInitialized } from "@/lib/db";

// Explicitly set runtime to nodejs (required for Prisma on Vercel)
export const runtime = "nodejs";
// Ensure Vercel always runs this as serverless (avoids static/edge and 500 HTML)
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me - Get current user
 * Security: Rate limited
 */
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    logger.info("GET /api/auth/me", {
      requestId,
      url: request.url,
      method: request.method,
      environment: process.env.VERCEL ? "vercel" : "local",
      runtime: "nodejs", // Explicitly log runtime
      headers: {
        cookie: request.headers.get("cookie") ? "present" : "missing",
        userAgent: request.headers.get("user-agent")?.substring(0, 50) || "unknown",
      },
    });

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      logger.warn("Rate limit exceeded for /api/auth/me", { requestId });
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { 
          status: 429,
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    logger.debug("Rate limit check passed", { requestId, remaining: rateLimitResult.remaining });

    // Check database connection first
    logger.debug("Checking database connection", { requestId });
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.connected) {
      logger.error("Database connection failed in /api/auth/me", { 
        requestId,
        error: dbCheck.error,
        environment: process.env.VERCEL ? "vercel" : "local",
      });
      return NextResponse.json(
        { 
          user: null,
          error: "DatabaseError",
          message: `Database connection failed: ${dbCheck.error || "Unknown error"}. If you're on Vercel, the database may need to be initialized. Please call /api/admin/init-db first.`
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    logger.debug("Database connection OK", { requestId });

    // Check if database is initialized (has users)
    logger.debug("Checking if database is initialized", { requestId });
    const isInitialized = await isDatabaseInitialized();
    if (!isInitialized && process.env.VERCEL) {
      logger.warn("Database not initialized on Vercel", { requestId });
      return NextResponse.json(
        { 
          user: null,
          error: "DatabaseNotInitialized",
          message: "Database is not initialized. Please call /api/admin/init-db first to create users."
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    logger.debug("Database initialized check passed", { requestId, isInitialized });

    // Try to get current user
    logger.debug("Attempting to get current user", { requestId });
    let user;
    try {
      user = await getCurrentUser();
    } catch (getUserError) {
      // getCurrentUser() should never throw (it returns null on errors)
      // But if it does, we need to catch it
      const errorMessage = getUserError instanceof Error ? getUserError.message : "Unknown error";
      logger.error("getCurrentUser() threw an error (unexpected)", {
        requestId,
        error: errorMessage,
        errorType: getUserError instanceof Error ? getUserError.constructor.name : typeof getUserError,
        stack: getUserError instanceof Error ? getUserError.stack : undefined,
        environment: process.env.VERCEL ? "vercel" : "local",
      });
      // Return null user instead of crashing
      user = null;
    }

    if (!user) {
      logger.debug("No user found in /api/auth/me (no cookie or user not found)", { requestId });
      const response = NextResponse.json({ user: null }, {
        headers: {
          "Content-Type": "application/json",
        }
      });
      if (rateLimitResult) {
        response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
      }
      return response;
    }

    logger.info("User found in /api/auth/me", {
      requestId,
      userId: user.id.substring(0, 8) + "***",
      email: user.email.substring(0, 3) + "***",
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }, {
      headers: {
        "Content-Type": "application/json",
      }
    });

    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    logger.debug("Successfully returning user data", { requestId });
    return response;
  } catch (error) {
    // Log detailed error for debugging
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error };
    
    logger.error("Unexpected error in /api/auth/me", { 
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ...errorDetails,
      environment: process.env.VERCEL ? "vercel" : "local",
      url: request.url,
      method: request.method,
      runtime: "nodejs",
    });
    
    // Check if it's a database connection error
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("prisma") || errorMessage.includes("database") || errorMessage.includes("connection") || errorMessage.includes("initialize")) {
        logger.error("Database connection error detected in /api/auth/me", { 
          error: error.message,
          environment: process.env.VERCEL ? "vercel" : "local",
        });
        return NextResponse.json(
          { 
            user: null,
            error: "DatabaseError",
            message: error.message.includes("initialize") 
              ? error.message
              : "Database connection error. If you're on Vercel, the database may need to be initialized. Please call /api/admin/init-db first."
          },
          { 
            status: 500,
            headers: {
              "Content-Type": "application/json",
            }
          }
        );
      }
      
      // Check if it's a cookies() API error
      if (errorMessage.includes("cookies") || errorMessage.includes("dynamic") || errorMessage.includes("edge")) {
        logger.error("Cookies API error detected in /api/auth/me", {
          error: error.message,
          environment: process.env.VERCEL ? "vercel" : "local",
          note: "This might indicate a runtime mismatch - cookies() requires Node.js runtime",
        });
        return NextResponse.json(
          {
            user: null,
            error: "RuntimeError",
            message: "Authentication system error. Please check server logs for details."
          },
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            }
          }
        );
      }
    }
    
    // Return proper error response - always JSON, never HTML
    return NextResponse.json(
      { 
        user: null,
        error: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "An unexpected error occurred. Please try again later."
      },
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
        }
      }
    );
  }
}
