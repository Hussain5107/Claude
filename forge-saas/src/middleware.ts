import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only run on real page navigations.
     *
     * Everything excluded here previously went through updateSession, which
     * calls supabase.auth.getUser() — and that triggers a token refresh when
     * the access token has expired. Supabase refresh tokens are single-use, so
     * when a PWA launch fetched /dashboard, /manifest.webmanifest and /sw.js at
     * the same moment, all three raced to redeem the same refresh token. One
     * won, the others got "already used" and dropped the session, kicking the
     * user back to the login screen on every cold start.
     *
     * API routes are excluded too: they authenticate themselves (the cron route
     * checks CRON_SECRET), and running the session check first meant unauthenticated
     * callers like Vercel Cron were redirected to /login before reaching them.
     */
    "/((?!api/|_next/static|_next/image|favicon\\.ico|images/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|txt|webmanifest)$).*)",
  ],
};
