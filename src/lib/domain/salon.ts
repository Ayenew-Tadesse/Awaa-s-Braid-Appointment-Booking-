// The salon's side of the diary: what can be done with an appointment, checking
// working hours before they're saved, and the numbers for the reports.
import type { Appointment, AppointmentStatus, Style, WorkingHours } from "./types";
import { addDays, at, localDay, weekdayOf } from "./time";

export type SalonAction = "confirm" | "decline" | "reschedule" | "done" | "no_show" | "cancel";

/**
 * What the salon can do with an appointment now. A request: confirm, decline or
 * move it. A confirmed one: move or cancel it. Once it has started (or for a
 * request whose time has come), mark it done or missed. Finished ones are final.
 */
export function salonActions(a: Appointment, now: Date): SalonAction[] {
  const started = Date.parse(a.starts_at) <= now.getTime();
  if (a.status === "pending") return started ? ["done", "no_show", "decline"] : ["confirm", "decline", "reschedule"];
  if (a.status === "confirmed") return started ? ["done", "no_show"] : ["reschedule", "cancel"];
  return [];
}

/** The status an action leads to. */
export const ACTION_STATUS: Record<Exclude<SalonAction, "reschedule">, Exclude<AppointmentStatus, "pending">> = {
  confirm: "confirmed", decline: "cancelled", cancel: "cancelled", done: "completed", no_show: "no_show",
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Why a week of working hours can't be saved (null when it can): real times, each block ends after it starts, no overlaps on a day. */
export function hoursProblem(blocks: Pick<WorkingHours, "weekday" | "starts" | "ends">[]): string | null {
  for (const b of blocks) {
    if (!HHMM.test(b.starts) || !HHMM.test(b.ends)) return "Use times like 09:00.";
    if (b.ends <= b.starts) return "Each block must end after it starts.";
    if (b.weekday < 0 || b.weekday > 6) return "Unknown day.";
  }
  for (let d = 0; d < 7; d++) {
    const day = blocks.filter((b) => b.weekday === d).sort((x, y) => x.starts.localeCompare(y.starts));
    for (let i = 1; i < day.length; i++) if (day[i].starts < day[i - 1].ends) return "Two blocks on the same day overlap.";
  }
  return null;
}

/** Why a style can't be saved (null when it can). */
export function styleProblem(s: Pick<Style, "name" | "duration_minutes" | "price">): string | null {
  if (!s.name.trim()) return "Give the style a name.";
  if (!Number.isInteger(s.duration_minutes) || s.duration_minutes < 15 || s.duration_minutes > 720) return "The time must be between 15 minutes and 12 hours.";
  if (!(s.price >= 0)) return "The price can't be negative.";
  return null;
}

export type Report = {
  weeks: { start: string; booked: number }[];
  popular: { style: string; count: number }[];
  noShowRate: number | null;
  cancelRate: number | null;
  earned30: number;
  expected7: number;
};

/**
 * The salon's numbers: bookings per week (the last 8 weeks, Monday to Sunday,
 * by the appointment's day), the most booked styles and the no-show and
 * cancellation rates (last 90 days), what was earned (done, last 30 days) and
 * what's expected (open, next 7 days).
 */
export function salonReport(appointments: Appointment[], now: Date, timeZone: string): Report {
  const today = localDay(now, timeZone);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const t = now.getTime(), day = 86400000;
  const kept = appointments.filter((a) => a.status !== "cancelled");
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(monday, (i - 7) * 7);
    const [from, to] = [at(start, "00:00", timeZone).getTime(), at(addDays(start, 7), "00:00", timeZone).getTime()];
    return { start, booked: kept.filter((a) => Date.parse(a.starts_at) >= from && Date.parse(a.starts_at) < to).length };
  });
  const recent = appointments.filter((a) => Date.parse(a.starts_at) >= t - 90 * day && Date.parse(a.starts_at) <= t);
  const counts = new Map<string, number>();
  for (const a of recent.filter((x) => x.status !== "cancelled")) counts.set(a.style_name, (counts.get(a.style_name) ?? 0) + 1);
  const finished = recent.filter((a) => a.status === "completed" || a.status === "no_show");
  const all = recent.length;
  return {
    weeks,
    popular: [...counts].map(([style, count]) => ({ style, count })).sort((a, b) => b.count - a.count || a.style.localeCompare(b.style)).slice(0, 5),
    noShowRate: finished.length ? finished.filter((a) => a.status === "no_show").length / finished.length : null,
    cancelRate: all ? recent.filter((a) => a.status === "cancelled").length / all : null,
    earned30: appointments.filter((a) => a.status === "completed" && Date.parse(a.starts_at) >= t - 30 * day && Date.parse(a.starts_at) <= t).reduce((s, a) => s + a.price, 0),
    expected7: appointments.filter((a) => (a.status === "pending" || a.status === "confirmed") && Date.parse(a.starts_at) >= t && Date.parse(a.starts_at) < t + 7 * day).reduce((s, a) => s + a.price, 0),
  };
}
