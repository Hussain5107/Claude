import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Everything under /auth is public on purpose. The callback has to be reachable
// before a session exists, and signing out has to be reachable *after* one has
// expired — bouncing a sign-out to the login screen leaves the user stuck on an
// error page trying to leave.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/pricing", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    // A form post that lands here must not be replayed against /login: the
    // default 307 preserves the method, and a page answering POST returns 405,
    // which the browser shows as "This page isn't working". 303 sends the user
    // to the login screen as a plain GET.
    return NextResponse.redirect(url, { status: request.method === "GET" ? 307 : 303 });
  }

  return response;
}
