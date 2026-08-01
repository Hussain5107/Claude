import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303, not the default 307. A 307 preserves the request method, so the
  // browser follows this by POSTing to "/" — which is a page, not a handler,
  // and answers POST with 405. That 405 is what the browser renders as "This
  // page isn't working". 303 means "your POST worked, now GET this instead",
  // which is exactly what should happen after signing out.
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
