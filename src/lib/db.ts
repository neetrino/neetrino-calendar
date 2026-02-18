import { PrismaClient } from "@prisma/client";
// Validate environment variables on import
import "./env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_URL обязателен (PostgreSQL, например Neon). Задаётся в .env или Vercel Environment Variables.

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Check if database is initialized (has at least one user)
 * Used to detect if database needs initialization on Vercel
 */
export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const userCount = await db.user.count();
    return userCount > 0;
  } catch (error) {
    // If we can't query the database, assume it's not initialized
    console.error("[DB] Error checking database initialization:", error);
    return false;
  }
}

/**
 * Check database connection health
 * Returns true if database is accessible, false otherwise
 */
export async function checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[DB] Database connection check failed:", errorMessage);
    return { connected: false, error: errorMessage };
  }
}
