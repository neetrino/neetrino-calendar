/**
 * Authorization Utilities
 * Protects against IDOR (Insecure Direct Object Reference) attacks
 * Ensures users can only access resources they own or have permission to view
 */

import { db } from "./db";
import { ForbiddenError, NotFoundError } from "./errors";
import type { User } from "@prisma/client";

/**
 * Check if user has permission to view/edit calendar items
 * Based on UserPermission model (myLevel, allLevel)
 */
async function checkCalendarPermission(
  user: User,
  itemCreatedById: string,
  requiredLevel: "VIEW" | "EDIT" = "VIEW"
): Promise<boolean> {
  // User can always access their own items
  if (user.id === itemCreatedById) {
    return true;
  }

  // Check permissions
  const permission = await db.userPermission.findUnique({
    where: {
      userId_module: {
        userId: user.id,
        module: "meetings", // Calendar items fall under "meetings" module
      },
    },
  });

  if (!permission) {
    return false;
  }

  // Check allLevel (permission to view/edit all items)
  if (requiredLevel === "VIEW" && permission.allLevel === "VIEW") {
    return true;
  }
  if (requiredLevel === "VIEW" && permission.allLevel === "EDIT") {
    return true;
  }
  if (requiredLevel === "EDIT" && permission.allLevel === "EDIT") {
    return true;
  }

  return false;
}

/**
 * Check if user is participant in calendar item
 */
async function isCalendarItemParticipant(userId: string, itemId: string): Promise<boolean> {
  const participant = await db.calendarItemParticipant.findUnique({
    where: {
      itemId_userId: {
        itemId,
        userId,
      },
    },
  });

  return !!participant;
}

/**
 * Require that user owns the calendar item or has permission
 * Throws ForbiddenError if access denied
 */
export async function requireCalendarItemAccess(
  user: User,
  itemId: string,
  requiredLevel: "VIEW" | "EDIT" = "VIEW"
): Promise<void> {
  const item = await db.calendarItem.findUnique({
    where: { id: itemId },
    select: { createdById: true },
  });

  if (!item) {
    throw new NotFoundError("Calendar item not found");
  }

  // Check if user is owner
  if (user.id === item.createdById) {
    return;
  }

  // Check if user is participant (participants can view)
  if (requiredLevel === "VIEW") {
    const isParticipant = await isCalendarItemParticipant(user.id, itemId);
    if (isParticipant) {
      return;
    }
  }

  // Check permissions
  const hasPermission = await checkCalendarPermission(user, item.createdById, requiredLevel);
  if (!hasPermission) {
    throw new ForbiddenError("You do not have permission to access this calendar item");
  }
}

/**
 * Require that user owns the schedule entry
 * Throws ForbiddenError if access denied
 */
export async function requireScheduleEntryAccess(user: User, entryId: string): Promise<void> {
  const entry = await db.scheduleEntry.findUnique({
    where: { id: entryId },
    select: { userId: true },
  });

  if (!entry) {
    throw new NotFoundError("Schedule entry not found");
  }

  // Only owner can access their schedule entry
  // Admins can access all (checked separately via requireAdmin)
  if (user.id !== entry.userId && user.role !== "ADMIN") {
    throw new ForbiddenError("You do not have permission to access this schedule entry");
  }
}

/**
 * Filter calendar items based on user permissions
 * Returns where clause for Prisma query
 * Returns empty object {} if user has access to all items
 */
export async function getCalendarItemsFilter(user: User): Promise<
  | {
      OR: Array<{
        createdById?: string;
        participants?: { some: { userId: string } };
      }>;
    }
  | Record<string, never> // Empty object for "no filter" (access to all)
> {
  // Get user permissions
  const permission = await db.userPermission.findUnique({
    where: {
      userId_module: {
        userId: user.id,
        module: "meetings",
      },
    },
  });

  // If user has permission to view all items, return empty filter (no restrictions)
  if (permission && (permission.allLevel === "VIEW" || permission.allLevel === "EDIT")) {
    return {};
  }

  // Otherwise, filter by ownership and participation
  return {
    OR: [
      // User's own items
      { createdById: user.id },
      // Items where user is participant
      { participants: { some: { userId: user.id } } },
    ],
  };
}

/**
 * Filter schedule entries based on user permissions
 * Returns empty object {} if user has access to all entries
 */
export async function getScheduleEntriesFilter(user: User): Promise<
  | {
      OR: Array<{ userId?: string }>;
    }
  | Record<string, never> // Empty object for "no filter" (access to all)
> {
  const permission = await db.userPermission.findUnique({
    where: {
      userId_module: {
        userId: user.id,
        module: "schedule",
      },
    },
  });

  // If user has permission to view all entries, return empty filter (no restrictions)
  if (permission && (permission.allLevel === "VIEW" || permission.allLevel === "EDIT")) {
    return {};
  }

  // Otherwise, filter by ownership
  return {
    OR: [
      // User's own entries
      { userId: user.id },
    ],
  };
}
