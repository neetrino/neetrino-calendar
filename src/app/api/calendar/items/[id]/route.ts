import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UpdateCalendarItemSchema } from "@/lib/validations/calendar";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/calendar/items/:id - Update a calendar item (admin only)
 * Security: Rate limited, admin only, input validated, mass assignment protected
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    logger.info(`PATCH /api/calendar/items/${id}`);

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

    // Check if item exists
    const existingItem = await db.calendarItem.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!existingItem) {
      throw new Error("Calendar item not found");
    }

    const body = await request.json();

    // Validate request body
    const validatedBody = UpdateCalendarItemSchema.safeParse(body);
    if (!validatedBody.success) {
      throw new ValidationError("Invalid request body", validatedBody.error.errors);
    }

    const { participants, ...itemData } = validatedBody.data;

    // Update calendar item (createdById cannot be changed - mass assignment protection)
    const item = await db.calendarItem.update({
      where: { id },
      data: {
        ...itemData,
        startAt: itemData.startAt ? new Date(itemData.startAt) : undefined,
        endAt: itemData.endAt !== undefined ? (itemData.endAt ? new Date(itemData.endAt) : null) : undefined,
        // createdById is not in UpdateCalendarItemSchema, so it cannot be changed
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

    // Update participants if provided
    if (participants) {
      // Delete existing participants
      await db.calendarItemParticipant.deleteMany({
        where: { itemId: id },
      });

      // Create new participants
      if (participants.length > 0) {
        await db.calendarItemParticipant.createMany({
          data: participants.map((p) => ({
            itemId: id,
            userId: p.userId,
            role: p.role,
            rsvp: p.rsvp,
          })),
        });
      }

      // Refetch item with updated participants
      const updatedItem = await db.calendarItem.findUnique({
        where: { id },
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

      logger.info(`Updated calendar item`, { itemId: id, userId: user.id });

      const response = NextResponse.json({ item: updatedItem });
      if (rateLimitResult) {
        response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
      }
      return response;
    }

    logger.info(`Updated calendar item`, { itemId: id, userId: user.id });

    const response = NextResponse.json({ item });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }
    return response;
  } catch (error) {
    logger.error("Error updating calendar item", { error });
    return createErrorResponse(error);
  }
}

/**
 * DELETE /api/calendar/items/:id - Delete a calendar item (admin only)
 * Security: Rate limited, admin only
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    logger.info(`DELETE /api/calendar/items/${id}`);

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

    // Check if item exists
    const existingItem = await db.calendarItem.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingItem) {
      throw new Error("Calendar item not found");
    }

    // Delete calendar item (participants will be deleted due to onDelete: Cascade)
    await db.calendarItem.delete({
      where: { id },
    });

    logger.info(`Deleted calendar item`, { itemId: id, userId: user.id });

    const response = NextResponse.json({ success: true });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }
    return response;
  } catch (error) {
    logger.error("Error deleting calendar item", { error });
    return createErrorResponse(error);
  }
}
