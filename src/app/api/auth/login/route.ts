import { NextRequest, NextResponse } from "next/server";
import { db, checkDatabaseConnection, isDatabaseInitialized } from "@/lib/db";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger, securityLogger } from "@/lib/logger";
import { verifyPassword } from "@/lib/password";
import { z } from "zod";

// Explicitly set runtime to nodejs (required for Prisma on Vercel)
export const runtime = "nodejs";
// Ensure Vercel always runs this as serverless and accepts POST (avoids 405)
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  logger.info("OPTIONS /api/auth/login (CORS preflight)", {
    url: request.url,
    origin: request.headers.get("origin"),
    method: request.headers.get("access-control-request-method"),
    headers: request.headers.get("access-control-request-headers"),
    environment: process.env.VERCEL ? "vercel" : "local",
  });
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
}

/**
 * GET /api/auth/login - Not allowed; return JSON 405 so client never gets HTML
 */
export async function GET() {
  return NextResponse.json(
    { error: "MethodNotAllowed", message: "Use POST to log in." },
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" } }
  );
}

/**
 * POST /api/auth/login - Login user by email
 * Security: Rate limited, email enumeration protection, secure cookies
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    // Detailed logging for 405 diagnostics
    const requestMethod = request.method;
    const requestUrl = request.url;
    const contentType = request.headers.get("content-type");
    const origin = request.headers.get("origin");
    const userAgent = request.headers.get("user-agent");
    const referer = request.headers.get("referer");
    
    logger.info("POST /api/auth/login", {
      requestId,
      method: requestMethod,
      url: requestUrl,
      environment: process.env.VERCEL ? "vercel" : "local",
      runtime: "nodejs", // Explicitly log runtime
      headers: {
        contentType,
        origin,
        userAgent: userAgent?.substring(0, 50) || "unknown",
        referer: referer?.substring(0, 100) || "none",
        accept: request.headers.get("accept") || "unknown",
      },
      // Log if this is actually a POST request
      isPost: requestMethod === "POST",
      isOptions: requestMethod === "OPTIONS",
    });
    
    // Double-check that this is actually a POST request
    if (requestMethod !== "POST") {
      logger.error("Wrong HTTP method in /api/auth/login", {
        requestId,
        expected: "POST",
        received: requestMethod,
        url: requestUrl,
        environment: process.env.VERCEL ? "vercel" : "local",
      });
      return NextResponse.json(
        { 
          error: "MethodNotAllowed", 
          message: `This endpoint only accepts POST requests, but received ${requestMethod}. Please check your request method.`
        },
        { 
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Allow": "POST, OPTIONS",
          }
        }
      );
    }

    logger.debug("Request validation passed, checking rate limit", { requestId });

    // Rate limiting (strict: 5 requests per minute)
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.strict);
    if (!rateLimitResult) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
      securityLogger.rateLimitExceeded(ip, "/api/auth/login");
      logger.warn("Rate limit exceeded for /api/auth/login", { requestId, ip });
      return NextResponse.json(
        { error: "Too Many Requests", message: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Content-Type": "application/json",
          },
        }
      );
    }
    
    logger.debug("Rate limit check passed", { requestId, remaining: rateLimitResult.remaining });

    // Check database connection first
    logger.debug("Checking database connection", { requestId });
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.connected) {
      logger.error("Database connection failed in /api/auth/login", { 
        requestId,
        error: dbCheck.error,
        environment: process.env.VERCEL ? "vercel" : "local",
      });
      return NextResponse.json(
        { 
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
      logger.warn("Database not initialized on Vercel in /api/auth/login", { requestId });
      return NextResponse.json(
        { 
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

    // Parse request body with error handling
    logger.debug("Parsing request body", { requestId, contentType });
    let body;
    try {
      body = await request.json();
      logger.debug("Request body parsed successfully", { 
        requestId,
        hasEmail: !!body.email,
        hasPassword: !!body.password,
      });
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : "Unknown error";
      logger.error("Failed to parse request body", { 
        requestId,
        error: errorMessage,
        contentType,
        errorType: parseError instanceof Error ? parseError.constructor.name : typeof parseError,
      });
      return NextResponse.json(
        { 
          error: "InvalidRequest", 
          message: `Invalid request format: ${errorMessage}. Please check your input and Content-Type header.`
        },
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    // Validate input
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationError("Invalid email format", validated.error.issues);
    }

    const { email, password } = validated.data;

    // Find user by email
    // Use constant-time approach: always perform DB query, then check result
    const startTime = Date.now();
    let user;
    try {
      user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          passwordHash: true,
        },
      });
    } catch (dbError) {
      // Check if database is empty (common on Vercel with in-memory SQLite)
      const errorMessage = dbError instanceof Error ? dbError.message : "Unknown database error";
      logger.error("Database query error in /api/auth/login", { 
        error: errorMessage,
        environment: process.env.VERCEL ? "vercel" : "local",
      });
      
      // Return proper error response instead of throwing
      return NextResponse.json(
        { 
          error: "DatabaseError",
          message: `Database query error: ${errorMessage}. If you're on Vercel, please initialize the database first by calling /api/admin/init-db`
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    // Verify password (always perform verification to prevent timing attacks)
    // If user doesn't exist, use a real bcrypt hash to maintain constant time
    // This is a hash of a random string that will never match
    const dummyHash = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJqZ5q5Xe";
    const passwordHash = user?.passwordHash || dummyHash;
    const passwordValid = user ? await verifyPassword(password, passwordHash) : false;

    // Add artificial delay to prevent timing attacks
    // Ensure minimum response time regardless of user existence or password validity
    // bcrypt comparison takes ~100-200ms, so we ensure at least 200ms total
    const minResponseTime = 200; // 200ms minimum
    const elapsed = Date.now() - startTime;
    if (elapsed < minResponseTime) {
      await new Promise((resolve) => setTimeout(resolve, minResponseTime - elapsed));
    }

    // Always return same response format (prevent enumeration)
    // Never reveal if user exists or not, or if password is wrong
    if (!user || !passwordValid) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
      securityLogger.failedLogin(email, ip, !user ? "User not found" : "Invalid password");
      // Return generic error (same format as success, but without user data)
      return NextResponse.json(
        { error: "Invalid credentials", message: "Email or password is incorrect" },
        { 
          status: 200, // Always 200 to prevent enumeration
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    logger.info("User logged in successfully", {
      requestId,
      userId: user.id.substring(0, 8) + "***",
      email: user.email.substring(0, 3) + "***", // Partial email for logs
      role: user.role,
    });

    // Set secure cookie with user ID using NextResponse
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

    // Устанавливаем cookie через response.cookies для правильной работы в Next.js 15
    response.cookies.set("calendar_auth_user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Используем "lax" для лучшей совместимости при редиректах
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    // Log detailed error for debugging
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error };
    
    logger.error("Error in login endpoint", { 
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
        logger.error("Database connection error detected in /api/auth/login", { 
          error: error.message,
          environment: process.env.VERCEL ? "vercel" : "local",
        });
        return NextResponse.json(
          { 
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
    
    // Always return JSON, never HTML
    const errorResponse = createErrorResponse(error);
    errorResponse.headers.set("Content-Type", "application/json");
    return errorResponse;
  }
}
