import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for authentication check
 * Edge Runtime compatible - no Prisma or heavy imports
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public pages (no auth required)
  const publicPaths = ["/login"];
  if (publicPaths.includes(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Check for user ID cookie
  const userId = request.cookies.get("calendar_auth_user_id")?.value;

  // If no cookie - redirect to login
  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Note: Admin page access is checked at the page level, not in middleware
  // This avoids potential issues with Prisma client in middleware (Edge Runtime incompatible)
  // API routes check access themselves via requireAdmin()

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
