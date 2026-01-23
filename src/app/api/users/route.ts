import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * GET /api/users - Get all users (for select dropdowns)
 * Security: Rate limited, authenticated only, pagination limited
 */
export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/users");

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireAuth();

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      take: 1000, // Max limit to prevent DoS
      orderBy: {
        name: "asc",
      },
    });

    logger.info(`Found ${users.length} users`, { userId: user.id });

    const response = NextResponse.json({ users });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error fetching users", { error });
    return createErrorResponse(error);
  }
}
