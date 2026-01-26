import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { checkDatabaseConnection, isDatabaseInitialized } from "@/lib/db";

// Explicitly set runtime to nodejs (required for Prisma on Vercel)
export const runtime = "nodejs";

/**
 * GET /api/auth/me - Get current user
 * Security: Rate limited
 */
export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/auth/me", {
      url: request.url,
      method: request.method,
      environment: process.env.VERCEL ? "vercel" : "local",
    });

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      logger.warn("Rate limit exceeded for /api/auth/me");
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

    // Check database connection first
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.connected) {
      logger.error("Database connection failed in /api/auth/me", { 
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

    // Check if database is initialized (has users)
    const isInitialized = await isDatabaseInitialized();
    if (!isInitialized && process.env.VERCEL) {
      logger.warn("Database not initialized on Vercel");
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

    const user = await getCurrentUser();

    if (!user) {
      logger.debug("No user found in /api/auth/me (no cookie or user not found)");
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
      userId: user.id,
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

    return response;
  } catch (error) {
    // Log detailed error for debugging
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error };
    
    logger.error("Error getting current user", { 
      ...errorDetails,
      environment: process.env.VERCEL ? "vercel" : "local",
      url: request.url,
    });
    
    // Check if it's a database connection error
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("prisma") || errorMessage.includes("database") || errorMessage.includes("connection") || errorMessage.includes("initialize")) {
        logger.error("Database connection error in /api/auth/me", { 
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
    }
    
    // Return proper error response - always JSON, never HTML
    return NextResponse.json(
      { 
        user: null,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "An unexpected error occurred. Please try again later."
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
