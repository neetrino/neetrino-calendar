import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rateLimit";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { logger, securityLogger } from "@/lib/logger";

// Validation schema for updating permissions
const updatePermissionsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  permissions: z.array(
    z.object({
      module: z.enum(["meetings", "deadlines", "schedule"]),
      myLevel: z.enum(["NONE", "VIEW", "EDIT"]),
      allLevel: z.enum(["NONE", "VIEW", "EDIT"]),
    })
  ),
});

/**
 * GET /api/admin/permissions - Get all users with their permissions
 * Only accessible by ADMIN users
 * Security: Rate limited, admin only, pagination limited
 */
export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/admin/permissions");

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Verify admin access
    const user = await requireAdmin();

    // Get all users with their permissions
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
      },
      take: 1000, // Max limit to prevent DoS
      orderBy: {
        name: "asc",
      },
    });

    logger.info(`Found ${users.length} users with permissions`, { adminUserId: user.id });

    const response = NextResponse.json({ users });
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error fetching permissions", { error });
    return createErrorResponse(error);
  }
}

/**
 * PUT /api/admin/permissions - Update permissions for a user
 * Only accessible by ADMIN users
 * Security: Rate limited, admin only, input validated, audit logged
 */
export async function PUT(request: NextRequest) {
  try {
    logger.info("PUT /api/admin/permissions");

    // Rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.moderate);
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Verify admin access
    const adminUser = await requireAdmin();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updatePermissionsSchema.safeParse(body);

    if (!validatedData.success) {
      throw new ValidationError("Invalid request body", validatedData.error.errors);
    }

    // Verify user exists
    const targetUser = await db.user.findUnique({
      where: { id: validatedData.data.userId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Update permissions using upsert for each module
    const updatedPermissions = await Promise.all(
      validatedData.data.permissions.map(async (perm) => {
        return db.userPermission.upsert({
          where: {
            userId_module: {
              userId: validatedData.data.userId,
              module: perm.module,
            },
          },
          update: {
            myLevel: perm.myLevel,
            allLevel: perm.allLevel,
          },
          create: {
            userId: validatedData.data.userId,
            module: perm.module,
            myLevel: perm.myLevel,
            allLevel: perm.allLevel,
          },
        });
      })
    );

    // Audit log: permissions changed
    securityLogger.permissionChanged(adminUser.id, validatedData.data.userId, {
      permissions: validatedData.data.permissions,
    });

    logger.info(`Updated ${updatedPermissions.length} permissions`, {
      adminUserId: adminUser.id,
      targetUserId: validatedData.data.userId,
    });

    const response = NextResponse.json({
      message: "Permissions updated successfully",
      permissions: updatedPermissions,
    });

    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    }

    return response;
  } catch (error) {
    logger.error("Error updating permissions", { error });
    return createErrorResponse(error);
  }
}
