import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger, securityLogger } from "@/lib/logger";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * POST /api/auth/signup - Register a new user
 * Security: Rate limited, password validation, secure cookies
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/auth/signup");

    // Rate limiting (strict: 5 requests per minute)
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.strict);
    if (!rateLimitResult) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.ip || "unknown";
      securityLogger.rateLimitExceeded(ip, "/api/auth/signup");
      return NextResponse.json(
        { error: "Too Many Requests", message: "Too many registration attempts. Please try again later." },
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
    const validated = signupSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationError("Invalid input", validated.error.errors);
    }

    const { name, email, password } = validated.data;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      throw new ValidationError("Password does not meet requirements", passwordValidation.errors);
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      // Return generic error to prevent enumeration
      return NextResponse.json(
        { error: "Registration failed", message: "Unable to create account. Please try again later." },
        { status: 200 } // Always 200 to prevent enumeration
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "USER", // New users are always USER, not ADMIN
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    logger.info("User registered successfully", {
      userId: user.id,
      email: user.email.substring(0, 3) + "***", // Partial email for logs
    });

    // Set secure cookie with user ID using NextResponse
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );

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
    logger.error("Error in signup endpoint", { error });
    return createErrorResponse(error);
  }
}
