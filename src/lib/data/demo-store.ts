// The demo salon in this browser: shared by both demo accounts (so a customer's
// booking reaches the salon admin), saved in localStorage, with the database's
// rules applied in code (visibility.ts, domain/booking.ts). Clearly a demo:
// nothing leaves the browser; it starts fresh each day, and "Reset the demo" starts over.
import type { Appointment, AppointmentStatus, Dataset, NotificationKind, TimeOff } from "../domain/types";
import { isOpen } from "../domain/types";
import { busyFrom, freeSlots, MAX_UPCOMING, optionsProblem, quote, cancelRule, type Busy } from "../domain/booking";
import { hoursProblem, styleProblem } from "../domain/salon";
import { localDay } from "../domain/time";
import { buildWorld, noteFor, type World } from "../demo/seed";
import { visibleTo } from "./visibility";
import type { HoursDraft, NewBooking, OptionDraft, Store, StyleDraft, StylistDraft } from "./store";

const KEY = "awaa_demo_world_v1";
const ACCOUNT = "awaa_demo_account";
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** The demo salon, rebuilt each new day so its diary stays around today. */
export function loadWorld(now = new Date()): World {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const w = JSON.parse(raw) as World;
      w.notifications ??= []; // saved before notifications existed
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

  // The database's notification trigger, in code: who hears about what.
  private notify(w: World, kind: NotificationKind, a: Appointment) {
    const to = kind === "booked" || kind === "cancelled_by_customer" ? w.profiles.filter((p) => p.role === "admin").map((p) => p.id) : [a.customer_id];
    for (const user of to) w.notifications.push(noteFor(w, user, kind, a, uid(), this.clock().toISOString()));
  }

  async markRead(ids: string[]) {
    const w = loadWorld(this.clock());
    for (const n of w.notifications) if (ids.includes(n.id) && n.user_id === this.profileId && !n.read_at) n.read_at = this.clock().toISOString();
    saveWorld(w);
  }
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
    this.notify(w, "booked", a);
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
    this.notify(w, "cancelled_by_customer", a);
    saveWorld(w);
  }

  // The salon's tools: admins only, like the database's rules.
  private asAdmin(): World {
    const w = loadWorld(this.clock());
    if (w.profiles.find((p) => p.id === this.profileId)?.role !== "admin") throw new Error("You don't have permission to do that.");
    return w;
  }

  async setStatus(id: string, status: Exclude<AppointmentStatus, "pending">) {
    const w = this.asAdmin();
    const a = w.appointments.find((x) => x.id === id);
    if (!a) throw new Error("Appointment not found.");
    if ((status === "completed" || status === "no_show") && Date.parse(a.starts_at) > this.clock().getTime())
      throw new Error("An appointment can be marked done or missed once it has started.");
    const was = a.status;
    a.status = status;
    if (status === "cancelled") a.cancelled_by = "salon";
    if (status === "confirmed" && was === "pending") this.notify(w, "confirmed", a);
    if (status === "cancelled") this.notify(w, was === "pending" ? "declined" : "cancelled_by_salon", a);
    saveWorld(w);
  }

  async reschedule(id: string, startsAt: string, stylistId: string) {
    const now = this.clock();
    const w = this.asAdmin();
    const a = w.appointments.find((x) => x.id === id);
    if (!a) throw new Error("Appointment not found.");
    const minutes = (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000;
    const others = w.appointments.filter((x) => x.id !== id);
    const slot = freeSlots({ salon: w.salon, stylists: w.stylists, hours: w.hours, busy: busyFrom(others, w.timeOff),
      day: localDay(new Date(startsAt), w.salon.timezone), minutes, now, only: stylistId, forSalon: true })
      .find((s) => s.startsAt === new Date(startsAt).toISOString());
    if (!slot) throw new Error("That time is no longer free. Please pick another.");
    const changed = a.starts_at !== slot.startsAt || a.stylist_id !== stylistId;
    a.starts_at = slot.startsAt; a.ends_at = slot.endsAt; a.stylist_id = stylistId;
    if (changed) this.notify(w, "moved", a);
    saveWorld(w);
  }

  async saveStyle(style: StyleDraft, options: OptionDraft[]): Promise<string> {
    const w = this.asAdmin();
    const problem = styleProblem(style);
    if (problem) throw new Error(problem);
    const id = style.id ?? uid();
    const next = { ...style, id, name: style.name.trim(), description: style.description?.trim() || null };
    const i = w.styles.findIndex((s) => s.id === id);
    if (i >= 0) w.styles[i] = next; else w.styles.push(next);
    w.options = [...w.options.filter((o) => o.style_id !== id),
      ...options.filter((o) => o.label.trim()).map((o, n) => ({ ...o, id: uid(), style_id: id, label: o.label.trim(), sort: n + 1 }))];
    saveWorld(w);
    return id;
  }

  async saveStylist(stylist: StylistDraft, hours: HoursDraft[]): Promise<string> {
    const w = this.asAdmin();
    if (!stylist.name.trim()) throw new Error("Give the stylist a name.");
    const problem = hoursProblem(hours);
    if (problem) throw new Error(problem);
    const id = stylist.id ?? uid();
    const next = { ...stylist, id, name: stylist.name.trim(), bio: stylist.bio?.trim() || null };
    const i = w.stylists.findIndex((s) => s.id === id);
    if (i >= 0) w.stylists[i] = next; else w.stylists.push(next);
    w.hours = [...w.hours.filter((h) => h.stylist_id !== id), ...hours.map((h) => ({ ...h, id: uid(), stylist_id: id }))];
    saveWorld(w);
    return id;
  }

  async addTimeOff(t: Omit<TimeOff, "id">) {
    const w = this.asAdmin();
    if (!(Date.parse(t.ends_at) > Date.parse(t.starts_at))) throw new Error("Time off must end after it starts.");
    w.timeOff.push({ ...t, id: uid(), reason: t.reason?.trim() || null });
    saveWorld(w);
  }

  async removeTimeOff(id: string) {
    const w = this.asAdmin();
    w.timeOff = w.timeOff.filter((x) => x.id !== id);
    saveWorld(w);
  }
}
