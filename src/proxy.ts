// Keeps a real (Supabase) sign-in fresh: refreshes the session cookie before
// app pages and API calls. Only an optimistic step; the database's Row Level
// Security is what actually protects data. Does nothing in demo mode.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured()) return response;
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return response;
}

export const config = { matcher: ["/app/:path*", "/api/:path*"] };
