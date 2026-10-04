// The demo salon in this browser: shared by both demo accounts (so a customer's
// booking reaches the salon admin), saved in localStorage, with the database's
// rules applied in code (visibility.ts, domain/booking.ts). Clearly a demo:
// nothing leaves the browser; it starts fresh each day, and "Reset the demo" starts over.
import type { Appointment, Dataset } from "../domain/types";
import { isOpen } from "../domain/types";
import { busyFrom, freeSlots, MAX_UPCOMING, optionsProblem, quote, cancelRule, type Busy } from "../domain/booking";
import { localDay } from "../domain/time";
import { buildWorld, type World } from "../demo/seed";
import { visibleTo } from "./visibility";
import type { NewBooking, Store } from "./store";

const KEY = "awaa_demo_world_v1";
const ACCOUNT = "awaa_demo_account";
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** The demo salon, rebuilt each new day so its diary stays around today. */
export function loadWorld(now = new Date()): World {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const w = JSON.parse(raw) as World;
      if (w.builtOn === localDay(now, w.salon.timezone)) return w;
    }
  } catch { /* fresh */ }
  const w = buildWorld(now);
  saveWorld(w);
  return w;
}
export function saveWorld(w: World) { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* storage full or blocked: this visit only */ } }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* nothing to reset */ } }
export const demoAccount = () => { try { return localStorage.getItem(ACCOUNT); } catch { return null; } };
export const setDemoAccount = (profileId: string | null) => {
  try { if (profileId) localStorage.setItem(ACCOUNT, profileId); else localStorage.removeItem(ACCOUNT); } catch { /* this visit only */ }
};

export class DemoStore implements Store {
  mode = "demo" as const;
  constructor(private profileId: string, private clock: () => Date = () => new Date()) {}

  async load(): Promise<Dataset> { return visibleTo(loadWorld(this.clock()), this.profileId); }
  async signOut() { setDemoAccount(null); }

  async busyTimes(from: string, to: string): Promise<Busy[]> {
    const w = loadWorld(this.clock());
    return busyFrom(w.appointments, w.timeOff).filter((b) => b.starts_at < to && b.ends_at > from);
  }

  // The same checks, in the same order and words, as book_appointment() in the database.
  async book(b: NewBooking): Promise<Appointment> {
    const now = this.clock();
    const w = loadWorld(now);
    const me = w.profiles.find((p) => p.id === this.profileId);
    if (!me) throw new Error("Please sign in to book.");
    const style = w.styles.find((s) => s.id === b.styleId && s.active);
    if (!style) throw new Error("That style is no longer available.");
    const problem = optionsProblem(style, w.options, b.optionIds);
    if (problem) throw new Error(problem);
    const chosen = w.options.filter((o) => b.optionIds.includes(o.id)).sort((x, y) => x.sort - y.sort);
    const { minutes, price } = quote(style, chosen);
    const start = Date.parse(b.startsAt);
    if (!(start >= now.getTime() + w.salon.min_notice_hours * 3600000)) throw new Error(`Please book at least ${w.salon.min_notice_hours} hours ahead.`);
    if (start > now.getTime() + w.salon.booking_window_days * 86400000) throw new Error(`Bookings open ${w.salon.booking_window_days} days ahead.`);
    const upcoming = w.appointments.filter((a) => a.customer_id === me.id && isOpen(a) && Date.parse(a.starts_at) > now.getTime());
    if (upcoming.length >= MAX_UPCOMING) throw new Error(`You already have ${MAX_UPCOMING} upcoming appointments. Cancel one to book another.`);
    const day = localDay(new Date(start), w.salon.timezone);
    const slot = freeSlots({ salon: w.salon, stylists: w.stylists, hours: w.hours, busy: busyFrom(w.appointments, w.timeOff), day, minutes, now, only: b.stylistId })
      .find((s) => Date.parse(s.startsAt) === start);
    if (!slot) {
      const onGrid = new Date(start).getUTCSeconds() === 0 && Math.round(start / 60000) % w.salon.slot_minutes === 0;
      throw new Error(onGrid ? "That time is no longer free. Please pick another." : "Pick one of the offered times.");
    }
    const a: Appointment = {
      id: uid(), customer_id: me.id, stylist_id: slot.stylists[0], style_id: style.id, style_name: style.name,
      options: chosen.map((o) => ({ id: o.id, kind: o.kind, label: o.label })),
      starts_at: new Date(start).toISOString(), ends_at: new Date(start + minutes * 60000).toISOString(), price,
      status: "pending", note: b.note.trim().slice(0, 500) || null, cancelled_by: null, created_at: now.toISOString(),
    };
    w.appointments.push(a);
    saveWorld(w);
    return structuredClone(a);
  }

  async cancel(id: string) {
    const now = this.clock();
    const w = loadWorld(now);
    const a = w.appointments.find((x) => x.id === id && x.customer_id === this.profileId);
    if (!a) throw new Error("Appointment not found.");
    const rule = cancelRule(a, w.salon, now);
    if (rule === "no") throw new Error(isOpen(a) ? "This appointment has already started." : "This appointment can no longer be cancelled.");
    if (rule === "call") throw new Error(`Confirmed appointments can be cancelled up to ${w.salon.cancel_hours} hours before. Please call the salon.`);
    a.status = "cancelled";
    a.cancelled_by = "customer";
    saveWorld(w);
  }
}
