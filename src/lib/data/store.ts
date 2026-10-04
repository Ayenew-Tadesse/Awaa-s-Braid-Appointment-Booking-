// What the screens can ask for and do. Two stores implement it:
//   SupabaseStore: the real salon (Row Level Security decides what you see);
//   DemoStore: the demo salon kept in this browser, with the same rules (visibility.ts).
// Booking and the salon's tools arrive in the next milestones.
import type { Dataset } from "../domain/types";

export interface Store {
  mode: "demo" | "supabase";
  /** Everything the signed-in person may see. */
  load(): Promise<Dataset>;
  signOut(): Promise<void>;
}

/** A friendly message for any store error (database refusals, network, validation). */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/row-level security|permission denied|42501/i.test(m)) return "You don't have permission to do that.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "You're offline or the salon can't be reached. Please try again.";
  return m || "Something went wrong.";
}
