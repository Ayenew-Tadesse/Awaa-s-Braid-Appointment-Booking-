// What a person may see of the demo salon: the same rules as the database's
// Row Level Security (supabase/migrations/20261005000002_security.sql), so the
// demo behaves like the real thing.
//   everyone   the salon, active styles and their options, active stylists, working hours
//   customer   their own profile and their own appointments
//   admin      everything, including retired styles, time off and every customer
import type { Dataset } from "../domain/types";
import type { World } from "../demo/seed";

export function visibleTo(w: World, profileId: string): Dataset {
  const me = w.profiles.find((p) => p.id === profileId);
  if (!me) throw new Error("This demo account no longer exists.");
  const admin = me.role === "admin";
  const styles = w.styles.filter((s) => admin || s.active);
  return structuredClone({
    salon: w.salon,
    me,
    styles,
    options: w.options.filter((o) => styles.some((s) => s.id === o.style_id)),
    stylists: w.stylists.filter((s) => admin || s.active),
    hours: w.hours,
    timeOff: admin ? w.timeOff : [],
    appointments: w.appointments.filter((a) => admin || a.customer_id === me.id),
    people: admin ? w.profiles : [me],
  });
}
