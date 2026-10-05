// Who may use which website (lib/supabase/config.ts SITE). The database's rules
// decide what anyone can see or change; this only keeps people on the right site.
import type { SiteKind } from "../supabase/config";
import type { Profile } from "./types";

export type SiteVerdict = "ok" | "use-staff-site" | "staff-only" | "waiting";

export function siteVerdict(site: SiteKind, me: Pick<Profile, "role" | "wants_stylist">): SiteVerdict {
  if (site === "demo") return "ok";
  if (site === "customer") return me.role === "customer" ? "ok" : "use-staff-site";
  if (me.role === "admin" || me.role === "stylist") return "ok";
  return me.wants_stylist ? "waiting" : "staff-only";
}
