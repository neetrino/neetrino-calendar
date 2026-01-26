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
    
    // В Next.js 15 delete() принимает только имя cookie
    // Для правильного удаления с указанием path используем set() с maxAge: 0
    response.cookies.set("calendar_auth_user_id", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
