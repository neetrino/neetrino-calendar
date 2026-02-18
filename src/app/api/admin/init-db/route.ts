import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { logger } from "@/lib/logger";

// Explicitly set runtime to nodejs (required for Prisma on Vercel)
export const runtime = "nodejs";

/**
 * POST /api/admin/init-db - Initialize database with seed data
 * This endpoint should be called once after deployment to Vercel
 * (e.g. after first deploy to Neon)
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/admin/init-db - Initializing database");

    // Check if database already has users
    const userCount = await db.user.count();
    
    if (userCount > 0) {
      return NextResponse.json({
        message: "Database already initialized",
        userCount,
      });
    }

    // Hash passwords
    const defaultPassword = "Password123!";
    const adminPasswordHash = await hashPassword(defaultPassword);
    const userPasswordHash = await hashPassword(defaultPassword);

    // Create admin user
    const admin = await db.user.create({
      data: {
        name: "Admin User",
        email: "admin@example.com",
        passwordHash: adminPasswordHash,
        role: "ADMIN",
      },
    });

    // Create regular users
    const users = await Promise.all([
      db.user.create({
        data: {
          name: "Alice Johnson",
          email: "alice@example.com",
          passwordHash: userPasswordHash,
          role: "USER",
        },
      }),
      db.user.create({
        data: {
          name: "Bob Smith",
          email: "bob@example.com",
          passwordHash: userPasswordHash,
          role: "USER",
        },
      }),
      db.user.create({
        data: {
          name: "Carol Williams",
          email: "carol@example.com",
          passwordHash: userPasswordHash,
          role: "USER",
        },
      }),
      db.user.create({
        data: {
          name: "David Brown",
          email: "david@example.com",
          passwordHash: userPasswordHash,
          role: "USER",
        },
      }),
      db.user.create({
        data: {
          name: "Emma Davis",
          email: "emma@example.com",
          passwordHash: userPasswordHash,
          role: "USER",
        },
      }),
    ]);

    // Create permissions for admin
    const modules = ["meetings", "deadlines", "schedule"];
    for (const module of modules) {
      await db.userPermission.create({
        data: {
          userId: admin.id,
          module: module,
          myLevel: "EDIT",
          allLevel: "EDIT",
        },
      });
    }

    // Create permissions for regular users
    await db.userPermission.createMany({
      data: [
        { userId: users[0].id, module: "meetings", myLevel: "EDIT", allLevel: "VIEW" },
        { userId: users[0].id, module: "deadlines", myLevel: "VIEW", allLevel: "NONE" },
        { userId: users[0].id, module: "schedule", myLevel: "VIEW", allLevel: "VIEW" },
        { userId: users[1].id, module: "meetings", myLevel: "VIEW", allLevel: "VIEW" },
        { userId: users[1].id, module: "deadlines", myLevel: "EDIT", allLevel: "VIEW" },
        { userId: users[1].id, module: "schedule", myLevel: "VIEW", allLevel: "NONE" },
        { userId: users[2].id, module: "meetings", myLevel: "VIEW", allLevel: "NONE" },
        { userId: users[2].id, module: "deadlines", myLevel: "VIEW", allLevel: "NONE" },
        { userId: users[2].id, module: "schedule", myLevel: "EDIT", allLevel: "EDIT" },
        { userId: users[3].id, module: "meetings", myLevel: "NONE", allLevel: "NONE" },
        { userId: users[3].id, module: "deadlines", myLevel: "NONE", allLevel: "NONE" },
        { userId: users[3].id, module: "schedule", myLevel: "NONE", allLevel: "NONE" },
        { userId: users[4].id, module: "meetings", myLevel: "VIEW", allLevel: "VIEW" },
        { userId: users[4].id, module: "deadlines", myLevel: "VIEW", allLevel: "VIEW" },
        { userId: users[4].id, module: "schedule", myLevel: "VIEW", allLevel: "VIEW" },
      ],
    });

    logger.info("Database initialized successfully", {
      adminEmail: admin.email,
      userCount: users.length + 1,
    });

    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
      admin: {
        email: "admin@example.com",
        password: defaultPassword,
      },
      userCount: users.length + 1,
    });
  } catch (error) {
    logger.error("Error initializing database", { error });
    return NextResponse.json(
      {
        error: "DatabaseInitializationError",
        message: error instanceof Error ? error.message : "Failed to initialize database",
      },
      { status: 500 }
    );
  }
}
