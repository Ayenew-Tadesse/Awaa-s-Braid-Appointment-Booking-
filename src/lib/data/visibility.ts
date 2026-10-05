// What a person may see of the demo salon: the same rules as the database's
// Row Level Security (supabase/migrations/20261005000002_security.sql), so the
// demo behaves like the real thing.
//   everyone   the salon, active styles and their options, active stylists, working hours
//              (and a customer, the stylists who did their own appointments)
//   customer   their own profile and their own appointments
//   stylist    also their own jobs, the customers on them, their own time off
//              (20261011000001_stylist_logins.sql)
//   admin      everything, including retired styles, time off and every customer
import type { Dataset } from "../domain/types";
import type { World } from "../demo/seed";

export function visibleTo(w: World, profileId: string): Dataset {
  const me = w.profiles.find((p) => p.id === profileId);
  if (!me) throw new Error("This demo account no longer exists.");
  const admin = me.role === "admin";
  // The stylist this login is linked to (only while it's a stylist account).
  const mine = me.role === "stylist" ? w.stylists.find((s) => s.profile_id === me.id && !s.removed_at)?.id : undefined;
  const jobs = mine ? w.appointments.filter((a) => a.stylist_id === mine) : [];
  const styles = w.styles.filter((s) => admin || s.active);
  return structuredClone({
    salon: w.salon,
    me,
    styles,
    options: w.options.filter((o) => styles.some((s) => s.id === o.style_id)),
    stylists: w.stylists.filter((s) => admin || (s.active && !s.removed_at) || s.profile_id === me.id || w.appointments.some((a) => a.stylist_id === s.id && a.customer_id === me.id)),
    hours: w.hours,
    timeOff: admin ? w.timeOff : w.timeOff.filter((x) => x.stylist_id === mine),
    appointments: w.appointments.filter((a) => admin || a.customer_id === me.id || a.stylist_id === mine),
    people: admin ? w.profiles : [me, ...w.profiles.filter((p) => p.id !== me.id && jobs.some((a) => a.customer_id === p.id))],
    // Newest first; made at the same moment, the later one first.
    notifications: w.notifications.filter((n) => n.user_id === me.id).reverse().sort((a, b) => b.created_at.localeCompare(a.created_at)),
  });
}
