import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UpdateScheduleEntrySchema } from "@/lib/validations/schedule";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/schedule/:id - Update a schedule entry (admin only)
 * Security: Rate limited, admin only, input validated, mass assignment protected
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    logger.info(`PATCH /api/schedule/${id}`);

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

    // Check if entry exists
    const existingEntry = await db.scheduleEntry.findUnique({
      where: { id },
      select: { id: true, date: true, userId: true, startTime: true, endTime: true },
    });

    if (!existingEntry) {
      throw new Error("Schedule entry not found");
    }

    const body = await request.json();

    // Validate request body
    const validatedBody = UpdateScheduleEntrySchema.safeParse(body);
    if (!validatedBody.success) {
      throw new ValidationError("Invalid request body", validatedBody.error.errors);
    }

    const { date, userId, startTime, endTime, note } = validatedBody.data;

    // If date or userId changed, check for conflicts
    if (date || userId) {
      const newDate = date ? new Date(date) : existingEntry.date;
      newDate.setHours(0, 0, 0, 0);
      const newUserId = userId || existingEntry.userId;

      const startOfDay = new Date(newDate);
      const endOfDay = new Date(newDate);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const conflictingEntry = await db.scheduleEntry.findFirst({
        where: {
          id: { not: id },
          userId: newUserId,
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      });

      if (conflictingEntry) {
        throw new ValidationError("Schedule entry already exists for this user on this date");
      }
    }

    // Validate time range if both are provided
    const finalStartTime = startTime !== undefined ? startTime : existingEntry.startTime;
    const finalEndTime = endTime !== undefined ? endTime : existingEntry.endTime;

    if (finalEndTime <= finalStartTime) {
      throw new ValidationError("End time must be after start time");
    }

    // Update entry (createdById cannot be changed - mass assignment protection)
    const entry = await db.scheduleEntry.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        userId,
        startTime,
        endTime,
        note,
        // createdById is not in UpdateScheduleEntrySchema, so it cannot be changed
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

    logger.info(`Updated schedule entry`, { entryId: id, userId: user.id });

    const response = NextResponse.json({ entry });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error updating schedule entry", { error });
    return createErrorResponse(error);
  }
}

/**
 * DELETE /api/schedule/:id - Delete a schedule entry (admin only)
 * Security: Rate limited, admin only
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    logger.info(`DELETE /api/schedule/${id}`);

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

    // Check if entry exists
    const existingEntry = await db.scheduleEntry.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingEntry) {
      throw new Error("Schedule entry not found");
    }

    // Delete entry
    await db.scheduleEntry.delete({
      where: { id },
    });

    logger.info(`Deleted schedule entry`, { entryId: id, userId: user.id });

    const response = NextResponse.json({ success: true });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error deleting schedule entry", { error });
    return createErrorResponse(error);
  }
}
