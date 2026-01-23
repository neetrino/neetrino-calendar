import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/logout - Logout user
 * Security: Rate limited
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/auth/logout");

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Удаляем cookie через response.cookies для правильной работы в Next.js 15
    const response = NextResponse.json({ success: true });
    
    response.cookies.delete("calendar_auth_user_id", {
      path: "/",
    });
    
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error logging out", { error });
    return createErrorResponse(error);
  }
}
