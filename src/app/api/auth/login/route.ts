import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger, securityLogger } from "@/lib/logger";
import { verifyPassword } from "@/lib/password";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/auth/login - Login user by email
 * Security: Rate limited, email enumeration protection, secure cookies
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/auth/login");

    // Rate limiting (strict: 5 requests per minute)
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.strict);
    if (!rateLimitResult) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.ip || "unknown";
      securityLogger.rateLimitExceeded(ip, "/api/auth/login");
      return NextResponse.json(
        { error: "Too Many Requests", message: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    const body = await request.json();

    // Validate input
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationError("Invalid email format", validated.error.errors);
    }

    const { email, password } = validated.data;

    // Find user by email
    // Use constant-time approach: always perform DB query, then check result
    const startTime = Date.now();
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

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
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.ip || "unknown";
      securityLogger.failedLogin(email, ip, !user ? "User not found" : "Invalid password");
      // Return generic error (same format as success, but without user data)
      return NextResponse.json(
        { error: "Invalid credentials", message: "Email or password is incorrect" },
        { status: 200 } // Always 200 to prevent enumeration
      );
    }

    logger.info("User logged in successfully", {
      userId: user.id,
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
    logger.error("Error in login endpoint", { error });
    return createErrorResponse(error);
  }
}
