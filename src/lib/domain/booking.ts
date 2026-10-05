// Booking rules, the same ones the database enforces (book_appointment and
// cancel_appointment in supabase/migrations/20261005000002_security.sql):
// the price and time come from the style and options; a time is offered only
// if it is on the salon's grid, with enough notice, inside the booking window
// and inside one of a stylist's working-hours blocks with nothing else booked,
// leaving the salon's travel time between one home visit and the next
// (20261009000001_home_visits.sql).
import type { Appointment, Salon, Style, StyleOption, Stylist, WorkingHours } from "./types";
import { isOpen } from "./types";
import { addDays, at, localDay, weekdayOf } from "./time";

/** What a style costs and how long it takes with the chosen options. */
export function quote(style: Style, chosen: StyleOption[]): { minutes: number; price: number } {
  return {
    minutes: Math.max(15, style.duration_minutes + chosen.reduce((s, o) => s + o.extra_minutes, 0)),
    price: Math.max(0, style.price + chosen.reduce((s, o) => s + o.extra_price, 0)),
  };
}

/** Why a set of options can't be booked for this style (null when it can). */
export function optionsProblem(style: Style, options: StyleOption[], chosenIds: string[]): string | null {
  const chosen = options.filter((o) => chosenIds.includes(o.id));
  if (chosen.length !== chosenIds.length || chosen.some((o) => o.style_id !== style.id)) return "Choose options from this style.";
  for (const kind of ["size", "length"] as const) {
    const offered = options.some((o) => o.style_id === style.id && o.kind === kind);
    const picked = chosen.filter((o) => o.kind === kind).length;
    if (picked > 1) return "Choose one size and one length.";
    if (offered && picked === 0) return kind === "size" ? "Choose a size." : "Choose a length.";
  }
  return null;
}

export type Busy = { stylist_id: string; starts_at: string; ends_at: string };
export type Slot = { startsAt: string; endsAt: string; stylists: string[] };

/**
 * Busy times from open appointments and time off: only who is busy and when, like
 * busy_times() (no names, no reasons, no addresses). Each visit also holds the
 * travel time before and after it, so the stylist can get to the next home.
 */
export function busyFrom(appointments: Appointment[], timeOff: Busy[], travelMinutes = 0): Busy[] {
  const travel = travelMinutes * 60000;
  return [
    ...appointments.filter(isOpen).map((a) => ({
      stylist_id: a.stylist_id,
      starts_at: new Date(Date.parse(a.starts_at) - travel).toISOString(),
      ends_at: a.busy_until ?? new Date(Date.parse(a.ends_at) + travel).toISOString(),
    })),
    ...timeOff.map(({ stylist_id, starts_at, ends_at }) => ({ stylist_id, starts_at, ends_at })),
  ];
}

/** A home address as the customer types it. */
export type Address = { address: string; city: string; zip: string };

/** Do we travel to this ZIP code? (Its first three digits are in the salon's list.) */
export const inServiceArea = (zip: string, salon: Pick<Salon, "service_zips">) => /^\d{5}$/.test(zip.trim()) && salon.service_zips.includes(zip.trim().slice(0, 3));

/** Why we can't come to this address (null when we can), checked again by book_appointment(). */
export function addressProblem(a: Address, salon: Pick<Salon, "service_zips">): "address" | "zip" | "area" | null {
  if (a.address.trim().length < 5 || a.city.trim().length < 2) return "address";
  if (!/^\d{5}$/.test(a.zip.trim())) return "zip";
  if (!inServiceArea(a.zip, salon)) return "area";
  return null;
}

/** The service area for people: ["200", …, "209", "220"] → "200–209, 220". */
export function areaLabel(zips: string[]): string {
  const n = [...new Set(zips)].map(Number).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < n.length; i++) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    const f = (x: number) => String(x).padStart(3, "0");
    parts.push(j > i ? `${f(n[i])}–${f(n[j])}` : f(n[i]));
    i = j;
  }
  return parts.join(", ");
}

/** A map link for the stylist (an ordinary Google Maps search; no key needed). */
export const mapsUrl = (a: Pick<Appointment, "visit_address" | "visit_city" | "visit_zip">) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.visit_address, a.visit_city, a.visit_zip].filter(Boolean).join(", "))}`;

/**
 * The free start times on a salon-local day for an appointment of `minutes`,
 * each with the stylists who are free then (in the salon's order).
 * `only` limits it to one stylist.
 */
export function freeSlots(args: {
  salon: Salon; stylists: Stylist[]; hours: WorkingHours[]; busy: Busy[];
  day: string; minutes: number; now: Date; only?: string | null;
  /** The salon moving an appointment: no notice or booking window, just not in the past. */
  forSalon?: boolean;
}): Slot[] {
  const { salon, hours, busy, day, minutes, now, only, forSalon } = args;
  const tz = salon.timezone;
  const earliest = now.getTime() + (forSalon ? 0 : salon.min_notice_hours * 3600000);
  const latest = forSalon ? Infinity : now.getTime() + salon.booking_window_days * 86400000;
  const stylists = args.stylists.filter((s) => s.active && (!only || s.id === only)).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const found = new Map<number, Slot>();
  for (const st of stylists) {
    const mine = busy.filter((b) => b.stylist_id === st.id).map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);
    for (const h of hours.filter((x) => x.stylist_id === st.id && x.weekday === weekdayOf(day))) {
      const [sh, sm] = h.starts.split(":").map(Number), [eh, em] = h.ends.split(":").map(Number);
      const open = sh * 60 + sm, close = eh * 60 + em;
      // Starts on the salon's grid (counted from midnight), inside this block.
      for (let m = Math.ceil(open / salon.slot_minutes) * salon.slot_minutes; m + minutes <= close; m += salon.slot_minutes) {
        const start = at(day, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, tz).getTime();
        const end = start + minutes * 60000;
        if (start < earliest || start > latest) continue;
        if (mine.some(([s, e]) => s < end && e > start)) continue;
        const slot = found.get(start) ?? { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), stylists: [] };
        slot.stylists.push(st.id);
        found.set(start, slot);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** The next `count` salon-local days a customer can book on (today first). */
export function bookableDays(salon: Salon, now: Date, count = 14): string[] {
  const today = localDay(now, salon.timezone);
  return Array.from({ length: Math.min(count, salon.booking_window_days + 1) }, (_, i) => addDays(today, i));
}

/**
 * Can the customer cancel it themselves? A request still waiting for the salon:
 * any time before it starts. A confirmed one: up to the salon's notice (cancel_hours).
 */
export function cancelRule(a: Appointment, salon: Salon, now: Date): "ok" | "call" | "no" {
  if (!isOpen(a) || Date.parse(a.starts_at) <= now.getTime()) return "no";
  if (a.status === "confirmed" && Date.parse(a.starts_at) < now.getTime() + salon.cancel_hours * 3600000) return "call";
  return "ok";
}

/** Customers may hold this many upcoming open bookings at once. */
export const MAX_UPCOMING = 3;
