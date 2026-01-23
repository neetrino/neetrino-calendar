import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { CreateScheduleEntrySchema, GetScheduleSchema } from "@/lib/validations/schedule";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getScheduleEntriesFilter } from "@/lib/authorize";

/**
 * GET /api/schedule - Get schedule entries for a specific date
 * Security: Rate limited, authorization filtered, pagination limited
 */
export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/schedule");

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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      throw new ValidationError("Date parameter is required");
    }

    // Validate query params
    const validatedQuery = GetScheduleSchema.safeParse({ date });
    if (!validatedQuery.success) {
      throw new ValidationError("Invalid date format", validatedQuery.error.errors);
    }

    // Parse date (set to start of day)
    const queryDate = new Date(validatedQuery.data.date);
    queryDate.setHours(0, 0, 0, 0);

    // Query for entries on that date
    const startOfDay = new Date(queryDate);
    const endOfDay = new Date(queryDate);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Get authorization filter (only show entries user has access to)
    const authFilter = await getScheduleEntriesFilter(user);

    const entries = await db.scheduleEntry.findMany({
      where: {
        ...authFilter,
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      take: 1000, // Max limit to prevent DoS
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ startTime: "asc" }, { user: { name: "asc" } }],
    });

    logger.info(`Found ${entries.length} schedule entries`, { userId: user.id, date });

    const response = NextResponse.json({ entries });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error fetching schedule", { error });
    return createErrorResponse(error);
  }
}

/**
 * POST /api/schedule - Create a new schedule entry (admin only)
 * Security: Rate limited, admin only, input validated, mass assignment protected
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/schedule");

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

    // Validate request body
    const validatedBody = CreateScheduleEntrySchema.safeParse(body);
    if (!validatedBody.success) {
      throw new ValidationError("Invalid request body", validatedBody.error.errors);
    }

    const { date, userId, startTime, endTime, note } = validatedBody.data;

    // Parse date
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Check for existing entry (unique constraint: date + userId)
    const startOfDay = new Date(entryDate);
    const endOfDay = new Date(entryDate);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const existingEntry = await db.scheduleEntry.findFirst({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (existingEntry) {
      throw new ValidationError("Schedule entry already exists for this user on this date");
    }

    // Create schedule entry (createdById always set to current user - mass assignment protection)
    const entry = await db.scheduleEntry.create({
      data: {
        date: entryDate,
        userId,
        startTime,
        endTime,
        note,
        createdById: user.id, // Always use current user, ignore any user input
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info("Created schedule entry", { entryId: entry.id, userId: user.id });

    const response = NextResponse.json({ entry }, { status: 201 });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error creating schedule entry", { error });
    return createErrorResponse(error);
  }
}
