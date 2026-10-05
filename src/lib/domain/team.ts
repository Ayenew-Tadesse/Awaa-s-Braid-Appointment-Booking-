// The team, as the salon manages it: each stylist's upcoming jobs, whether one
// can go to another stylist at the same time, and the day's jobs as a message
// to send the stylist (stylists don't sign in).
import { busyFrom, freeSlots, mapsUrl } from "./booking";
import { localDay } from "./time";
import type { Appointment, Dataset } from "./types";
import { isOpen } from "./types";

/** Open appointments for this stylist that haven't finished, soonest first. */
export const upcomingFor = (stylistId: string, appointments: Appointment[], now: Date) =>
  appointments.filter((a) => a.stylist_id === stylistId && isOpen(a) && Date.parse(a.ends_at) > now.getTime())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

/** Is `to` free for this appointment at the same time (hours, time off, other visits and travel)? */
export function freeAt(a: Appointment, to: string, data: Pick<Dataset, "salon" | "stylists" | "hours" | "timeOff" | "appointments">, now: Date): boolean {
  const busy = busyFrom(data.appointments.filter((x) => x.id !== a.id), data.timeOff, data.salon.travel_minutes);
  const minutes = (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000;
  return freeSlots({ salon: data.salon, stylists: data.stylists, hours: data.hours, busy, day: localDay(new Date(a.starts_at), data.salon.timezone), minutes, now, only: to, forSalon: true })
    .some((s) => s.startsAt === new Date(a.starts_at).toISOString());
}

/** One line per job for a message: time, style, customer and phone, address and a map link. */
export function jobLines(jobs: Appointment[], people: Dataset["people"], time: (iso: string) => string): string[] {
  return jobs.map((a) => {
    const c = people.find((p) => p.id === a.customer_id);
    const where = [a.visit_address, [a.visit_city, a.visit_zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return [`${time(a.starts_at)}–${time(a.ends_at)} · ${a.style_name}${a.options.length ? ` (${a.options.map((o) => o.label).join(", ")})` : ""}`,
      [c?.full_name, c?.phone].filter(Boolean).join(" · "), where, where ? mapsUrl(a) : "", a.note ? `“${a.note}”` : ""].filter(Boolean).join("\n");
  });
}
