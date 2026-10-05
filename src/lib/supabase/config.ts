// Public settings only: the project URL and the anon (public) key. Row Level
// Security in the database decides what each signed-in person may read or
// change. The service-role key never appears here (see app/api/admin/people).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Is a real Supabase project connected? Without one the platform runs as a demo. */
export const supabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/**
 * Which website this is. One codebase, three Vercel projects:
 *   demo      no Supabase values: the fictional salon, its tour and demo accounts (for the portfolio)
 *   customer  NEXT_PUBLIC_SITE=customer (or unset) with Supabase: customers sign in, sign up and book
 *   staff     NEXT_PUBLIC_SITE=staff with Supabase: the salon admin and stylists only
 */
export type SiteKind = "demo" | "customer" | "staff";
export const SITE: SiteKind = !supabaseConfigured() ? "demo" : process.env.NEXT_PUBLIC_SITE === "staff" ? "staff" : "customer";
/** The staff website's address, shown only to staff who signed in on the customer site (optional). */
export const STAFF_URL = process.env.NEXT_PUBLIC_STAFF_URL ?? "";
