import { z } from "zod";

/**
 * Environment variables schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Database (PostgreSQL, e.g. Neon)
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
 * Uses environment variables only for Edge Runtime compatibility
 */
function isBuildTime(): boolean {
  // Check if we're in build phase using Next.js environment variables
  // NEXT_PHASE is set during build
  const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  
  // On Vercel during build: VERCEL=1 but VERCEL_ENV is not set yet
  // During runtime: VERCEL=1 and VERCEL_ENV is set (production, preview, development)
  const isVercelBuild = process.env.VERCEL === "1" && !process.env.VERCEL_ENV;
  
  return isNextBuildPhase || isVercelBuild;
}

/**
 * Validated environment variables
 * Throws error if validation fails (only in runtime, not during build)
 */
export const env = (() => {
  try {
    const buildTime = isBuildTime();
    const databaseUrl = process.env.DATABASE_URL || (buildTime ? "postgresql://build-placeholder" : undefined);
    const authSecret = process.env.AUTH_SECRET || (buildTime ? "build-time-placeholder-min-32-chars-long-required" : undefined);
    
    const envData = {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: authSecret,
      NODE_ENV: process.env.NODE_ENV || "development",
      RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
      ENABLE_CSRF_PROTECTION: process.env.ENABLE_CSRF_PROTECTION,
    };
    
    return envSchema.parse(envData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const buildTime = isBuildTime();
      const missingAuthSecret = error.issues.some(e => e.path.includes("AUTH_SECRET"));
      const isVercelRuntime = process.env.VERCEL === "1" && process.env.VERCEL_ENV;

      // During build, or on Vercel at runtime without AUTH_SECRET: use placeholder so the app loads and returns JSON (not HTML 500)
      if ((buildTime || isVercelRuntime) && missingAuthSecret) {
        if (isVercelRuntime) {
          console.warn("⚠️  AUTH_SECRET not set on Vercel - using placeholder. Set AUTH_SECRET in Vercel Environment Variables for production.");
        } else if (buildTime) {
          console.warn("⚠️  AUTH_SECRET not set during build - using placeholder. Make sure to set it in Vercel environment variables!");
        }
        return envSchema.parse({
          DATABASE_URL: process.env.DATABASE_URL || (buildTime ? "postgresql://build-placeholder" : undefined!),
          AUTH_SECRET: "build-time-placeholder-min-32-chars-long-required",
          NODE_ENV: process.env.NODE_ENV || "development",
          RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
          ENABLE_CSRF_PROTECTION: process.env.ENABLE_CSRF_PROTECTION,
        });
      }

      const missingVars = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
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
