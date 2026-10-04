// Public settings only: the project URL and the anon (public) key. Row Level
// Security in the database decides what each signed-in person may read or
// change. The service-role key never appears here (see app/api/admin/people).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Is a real Supabase project connected? Without one the platform runs as a demo. */
export const supabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
