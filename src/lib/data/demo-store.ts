// The demo salon in this browser: shared by both demo accounts (so a customer's
// booking reaches the salon admin), saved in localStorage, with the database's
// rules applied in code (visibility.ts, domain/booking.ts). Clearly a demo:
// nothing leaves the browser; it starts fresh each day, and "Reset the demo" starts over.
import type { Appointment, AppointmentStatus, Dataset, NotificationKind, TimeOff } from "../domain/types";
import { isOpen } from "../domain/types";
import { addressProblem, busyFrom, freeSlots, MAX_UPCOMING, optionsProblem, quote, cancelRule, type Busy } from "../domain/booking";
import { hoursProblem, styleProblem } from "../domain/salon";
import { localDay } from "../domain/time";
import { buildWorld, noteFor, type World } from "../demo/seed";
import { visibleTo } from "./visibility";
import type { HoursDraft, NewBooking, OptionDraft, Store, StyleDraft, StylistDraft, VisitSettings } from "./store";

const KEY = "awaa_demo_world_v3"; // v3: stylist logins
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
  /** To the stylist's own login, if they have one. */
  private notifyStylist(w: World, stylistId: string, kind: NotificationKind, a: Appointment) {
    const login = w.stylists.find((s) => s.id === stylistId)?.profile_id;
    if (login && w.profiles.find((p) => p.id === login)?.role === "stylist") w.notifications.push(noteFor(w, login, kind, a, uid(), this.clock().toISOString()));
  }

  async markRead(ids: string[]) {
    const w = loadWorld(this.clock());
    for (const n of w.notifications) if (ids.includes(n.id) && n.user_id === this.profileId && !n.read_at) n.read_at = this.clock().toISOString();
    saveWorld(w);
  }
  async signOut() { setDemoAccount(null); }

  async busyTimes(from: string, to: string): Promise<Busy[]> {
    const w = loadWorld(this.clock());
    return busyFrom(w.appointments, w.timeOff, w.salon.travel_minutes).filter((b) => b.starts_at < to && b.ends_at > from);
  }

  // The same checks, in the same order and words, as book_appointment() in the database.
  async book(b: NewBooking): Promise<Appointment> {
    const now = this.clock();
    const w = loadWorld(now);
    const me = w.profiles.find((p) => p.id === this.profileId);
    if (!me) throw new Error("Please sign in to book.");
    const style = w.styles.find((s) => s.id === b.styleId && s.active);
    if (!style) throw new Error("That style is no longer available.");
    const where = { address: b.address.address.trim().slice(0, 200), city: b.address.city.trim().slice(0, 80), zip: b.address.zip.trim() };
    const wrong = addressProblem(where, w.salon);
    if (wrong === "address") throw new Error("Please add the address where we should come.");
    if (wrong === "zip") throw new Error("Please enter a 5-digit ZIP code.");
    if (wrong === "area") throw new Error("Sorry, we don't travel to that ZIP code yet.");
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
    const slot = freeSlots({ salon: w.salon, stylists: w.stylists, hours: w.hours, busy: busyFrom(w.appointments, w.timeOff, w.salon.travel_minutes), day, minutes, now, only: b.stylistId })
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
      visit_address: where.address, visit_city: where.city, visit_zip: where.zip,
      busy_until: new Date(start + (minutes + w.salon.travel_minutes) * 60000).toISOString(),
    };
    w.appointments.push(a);
    Object.assign(me, where); // saved for next time
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
    const was = a.status;
    a.status = "cancelled";
    a.cancelled_by = "customer";
    this.notify(w, "cancelled_by_customer", a);
    if (was === "confirmed") this.notifyStylist(w, a.stylist_id, "job_removed", a);
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
    if (status === "confirmed" && was === "pending") { this.notify(w, "confirmed", a); this.notifyStylist(w, a.stylist_id, "job_assigned", a); }
    if (status === "cancelled") this.notify(w, was === "pending" ? "declined" : "cancelled_by_salon", a);
    if (status === "cancelled" && was === "confirmed") this.notifyStylist(w, a.stylist_id, "job_removed", a);
    saveWorld(w);
  }

  async reschedule(id: string, startsAt: string, stylistId: string) {
    const now = this.clock();
    const w = this.asAdmin();
    const a = w.appointments.find((x) => x.id === id);
    if (!a) throw new Error("Appointment not found.");
    const minutes = (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000;
    const others = w.appointments.filter((x) => x.id !== id);
    const slot = freeSlots({ salon: w.salon, stylists: w.stylists, hours: w.hours, busy: busyFrom(others, w.timeOff, w.salon.travel_minutes),
      day: localDay(new Date(startsAt), w.salon.timezone), minutes, now, only: stylistId, forSalon: true })
      .find((s) => s.startsAt === new Date(startsAt).toISOString());
    if (!slot) throw new Error("That time is no longer free. Please pick another.");
    const changed = a.starts_at !== slot.startsAt || a.stylist_id !== stylistId;
    const before = { ...a };
    a.starts_at = slot.startsAt; a.ends_at = slot.endsAt; a.stylist_id = stylistId;
    if (changed && a.status === "confirmed") {
      if (before.stylist_id !== stylistId) { this.notifyStylist(w, before.stylist_id, "job_removed", before); this.notifyStylist(w, stylistId, "job_assigned", a); }
      else this.notifyStylist(w, stylistId, "job_moved", a);
    }
    a.busy_until = new Date(Date.parse(slot.endsAt) + w.salon.travel_minutes * 60000).toISOString();
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
    if (stylist.active && w.stylists.find((x) => x.id === id)?.removed_at) throw new Error("This stylist was removed. Add them again as a new stylist.");
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

  // Like remove_stylist(): only once nothing is upcoming; kept for history.
  async removeStylist(id: string) {
    const w = this.asAdmin();
    const s = w.stylists.find((x) => x.id === id);
    if (!s) throw new Error("Stylist not found.");
    if (w.appointments.some((a) => a.stylist_id === id && isOpen(a) && Date.parse(a.ends_at) > this.clock().getTime()))
      throw new Error("Move their upcoming appointments to another stylist first.");
    this.unlink(w, id);
    w.hours = w.hours.filter((h) => h.stylist_id !== id);
    w.timeOff = w.timeOff.filter((x) => x.stylist_id !== id || Date.parse(x.ends_at) <= this.clock().getTime());
    s.active = false;
    s.removed_at ??= this.clock().toISOString();
    saveWorld(w);
  }

  // Like link_stylist_login() / unlink_stylist_login(): admins only.
  async linkLogin(stylistId: string, email: string) {
    const w = this.asAdmin();
    const s = w.stylists.find((x) => x.id === stylistId && !x.removed_at);
    if (!s) throw new Error("Stylist not found.");
    const who = Object.entries(w.emails ?? {}).find(([, e]) => e.toLowerCase() === email.trim().toLowerCase())?.[0];
    const p = w.profiles.find((x) => x.id === who);
    if (!p) throw new Error("No account uses that email yet. Ask the stylist to sign up first.");
    if (p.role === "admin") throw new Error("That is an admin account.");
    if (w.stylists.some((x) => x.profile_id === p.id && x.id !== stylistId)) throw new Error("That account is already linked to another stylist.");
    if (s.profile_id && s.profile_id !== p.id) this.unlink(w, stylistId);
    s.profile_id = p.id;
    p.role = "stylist";
    saveWorld(w);
  }

  async unlinkLogin(stylistId: string) {
    const w = this.asAdmin();
    this.unlink(w, stylistId);
    saveWorld(w);
  }

  private unlink(w: World, stylistId: string) {
    const s = w.stylists.find((x) => x.id === stylistId);
    const p = w.profiles.find((x) => x.id === s?.profile_id);
    if (p?.role === "stylist") p.role = "customer";
    if (s) s.profile_id = null;
  }

  // Like mark_job(): a stylist's own confirmed job, once it has started.
  async markJob(id: string, status: "completed" | "no_show") {
    const w = loadWorld(this.clock());
    const mine = w.stylists.find((s) => s.profile_id === this.profileId && !s.removed_at && w.profiles.find((p) => p.id === this.profileId)?.role === "stylist");
    const a = w.appointments.find((x) => x.id === id && mine && x.stylist_id === mine.id);
    if (!a) throw new Error("Job not found.");
    if (a.status !== "confirmed") throw new Error("Only a confirmed job can be marked.");
    if (Date.parse(a.starts_at) > this.clock().getTime()) throw new Error("An appointment can be marked done or missed once it has started.");
    a.status = status;
    saveWorld(w);
  }

  async saveVisitSettings(v: VisitSettings) {
    const w = this.asAdmin();
    const zips = [...new Set(v.service_zips.map((z) => z.trim()).filter(Boolean))];
    if (!zips.length || zips.some((z) => !/^\d{3}$/.test(z))) throw new Error("Use the first three digits of each ZIP code, for example 200.");
    if (!(v.travel_minutes >= 0 && v.travel_minutes <= 240)) throw new Error("Travel time is 0 to 240 minutes.");
    w.salon.service_zips = zips;
    w.salon.travel_minutes = Math.round(v.travel_minutes);
    // Like the database: the new travel time applies to visits booked or moved from now on.
    saveWorld(w);
  }
}
