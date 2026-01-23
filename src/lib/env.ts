import { z } from "zod";

/**
 * Environment variables schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Database
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
 * Validated environment variables
 * Throws error if validation fails
 */
export const env = (() => {
  try {
    return envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
      ENABLE_CSRF_PROTECTION: process.env.ENABLE_CSRF_PROTECTION,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\nPlease check your .env file.`
      );
    }
    throw error;
  }
})();

/**
 * Type-safe environment variables
 */
export type Env = z.infer<typeof envSchema>;
