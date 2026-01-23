import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/me - Get current user
 * Security: Rate limited
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      const response = NextResponse.json({ user: null });
      if (rateLimitResult) {
        response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
      }
      return response;
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error getting current user", { error });
    return NextResponse.json({ user: null });
  }
}
