import { PrismaClient } from "@prisma/client";
// Validate environment variables on import
import "./env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Get database URL for current environment
 * On Vercel, use in-memory SQLite (data will be lost on restart)
 */
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  
  // If DATABASE_URL is explicitly set and not a file path, use it
  if (envUrl && !envUrl.startsWith("file:")) {
    return envUrl;
  }
  
  // On Vercel without explicit DATABASE_URL, use in-memory SQLite
  if (process.env.VERCEL && (!envUrl || envUrl.startsWith("file:"))) {
    console.warn(
      "⚠️  Using in-memory SQLite on Vercel. Data will be lost on restart. " +
      "Consider migrating to PostgreSQL or using external SQLite storage."
    );
    return "file::memory:?cache=shared";
  }
  
  // Default: use provided DATABASE_URL or fallback to dev.db
  return envUrl || "file:./dev.db";
}

// Set DATABASE_URL before PrismaClient reads it
if (!process.env.DATABASE_URL || (process.env.VERCEL && process.env.DATABASE_URL.startsWith("file:"))) {
  process.env.DATABASE_URL = getDatabaseUrl();
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
