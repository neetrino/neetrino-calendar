import { z } from "zod";

/**
 * Environment variables schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Database
  // On Vercel with SQLite, will use in-memory database if not provided
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters long")
    .describe("Secret key for session encryption (min 32 chars)"),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Optional: Rate limiting
  RATE_LIMIT_ENABLED: z
    .string()
    .optional()
    .transform((val) => val !== "false"), // Default to true unless explicitly false

  // Optional: CSRF protection
  ENABLE_CSRF_PROTECTION: z
    .string()
    .optional()
    .transform((val) => val !== "false"), // Default to true unless explicitly false
});

/**
 * Check if we're in build time (Prisma generation, not runtime)
 */
function isBuildTime(): boolean {
  // Check if we're running prisma generate or next build
  const isPrismaGenerate = process.argv.some(arg => arg.includes("prisma") && arg.includes("generate"));
  const isNextBuild = process.argv.some(arg => arg.includes("next") && arg.includes("build"));
  return isPrismaGenerate || isNextBuild;
}

/**
 * Validated environment variables
 * Throws error if validation fails (only in runtime, not during build)
 */
export const env = (() => {
  try {
    // On Vercel, provide default in-memory SQLite if DATABASE_URL is not set
    const databaseUrl = process.env.DATABASE_URL || (process.env.VERCEL ? "file::memory:?cache=shared" : undefined);
    
    // During build (prisma generate), use placeholder for AUTH_SECRET if not set
    const buildTime = isBuildTime();
    const authSecret = process.env.AUTH_SECRET || (buildTime ? "build-time-placeholder-min-32-chars-long-required" : undefined);
    
    const envData = {
      DATABASE_URL: databaseUrl || "file:./dev.db", // Fallback for local dev
      AUTH_SECRET: authSecret,
      NODE_ENV: process.env.NODE_ENV || "development",
      RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
      ENABLE_CSRF_PROTECTION: process.env.ENABLE_CSRF_PROTECTION,
    };
    
    return envSchema.parse(envData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // During build, allow missing AUTH_SECRET (it will be required at runtime)
      const buildTime = isBuildTime();
      const missingAuthSecret = error.errors.some(e => e.path.includes("AUTH_SECRET"));
      
      if (buildTime && missingAuthSecret) {
        console.warn("⚠️  AUTH_SECRET not set during build - using placeholder. Make sure to set it in Vercel environment variables!");
        // Return a valid env object with placeholder for build
        return envSchema.parse({
          DATABASE_URL: process.env.DATABASE_URL || (process.env.VERCEL ? "file::memory:?cache=shared" : "file:./dev.db"),
          AUTH_SECRET: "build-time-placeholder-min-32-chars-long-required",
          NODE_ENV: process.env.NODE_ENV || "development",
          RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
          ENABLE_CSRF_PROTECTION: process.env.ENABLE_CSRF_PROTECTION,
        });
      }
      
      const missingVars = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\nPlease check your .env file or Vercel environment variables.`
      );
    }
    throw error;
  }
})();

/**
 * Type-safe environment variables
 */
export type Env = z.infer<typeof envSchema>;
