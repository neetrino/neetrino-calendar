import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { CreateCalendarItemSchema, GetCalendarItemsSchema } from "@/lib/validations/calendar";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getCalendarItemsFilter } from "@/lib/authorize";

// Explicitly set runtime to nodejs (required for Prisma on Vercel)
export const runtime = "nodejs";

/**
 * GET /api/calendar/items - Get calendar items with filters
 * Security: Rate limited, authorization filtered, pagination limited
 */
export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/calendar/items");

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": String(rateLimitConfigs.moderate.max),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Require authentication
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const query = {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
    };

    // Validate query params
    const validatedQuery = GetCalendarItemsSchema.safeParse(query);
    if (!validatedQuery.success) {
      throw new ValidationError("Invalid query parameters", validatedQuery.error.issues);
    }

    const { from, to, type, status, search } = validatedQuery.data;

    // Get authorization filter (only show items user has access to)
    const authFilter = await getCalendarItemsFilter(user);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...authFilter,
    };

    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
      if (to) where.startAt.lte = new Date(to);
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.title = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Pagination limit (max 1000 items)
    const items = await db.calendarItem.findMany({
      where,
      take: 1000, // Max limit to prevent DoS
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    });

    logger.info(`Found ${items.length} calendar items`, { userId: user.id });

    // Add rate limit headers
    const response = NextResponse.json({ items });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
      response.headers.set("X-RateLimit-Reset", String(rateLimitResult.reset));
    }

    return response;
  } catch (error) {
    logger.error("Error fetching calendar items", { error });
    return createErrorResponse(error);
  }
}

/**
 * POST /api/calendar/items - Create a new calendar item (admin only)
 * Security: Rate limited, admin only, input validated, mass assignment protected
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/calendar/items");

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Require admin
    const user = await requireAdmin();

    const body = await request.json();

    // Validate request body (zod schema already protects against mass assignment)
    const validatedBody = CreateCalendarItemSchema.safeParse(body);
    if (!validatedBody.success) {
      throw new ValidationError("Invalid request body", validatedBody.error.issues);
    }

    const { participants, ...itemData } = validatedBody.data;

    // Ensure createdById is set to current user (prevent mass assignment)
    // Even if user tries to pass createdById, it will be overwritten
    const item = await db.calendarItem.create({
      data: {
        ...itemData,
        startAt: new Date(itemData.startAt),
        endAt: itemData.endAt ? new Date(itemData.endAt) : null,
        createdById: user.id, // Always use current user, ignore any user input
        participants: participants
          ? {
              create: participants.map((p) => ({
                userId: p.userId,
                role: p.role,
              })),
            }
          : undefined,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    logger.info("Created calendar item", { itemId: item.id, userId: user.id });

    const response = NextResponse.json({ item }, { status: 201 });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error creating calendar item", { error });
    return createErrorResponse(error);
  }
}
