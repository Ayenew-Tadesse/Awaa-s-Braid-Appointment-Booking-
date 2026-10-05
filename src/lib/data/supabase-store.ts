// The real salon, through Supabase. Every query runs as the signed-in person,
// so Row Level Security decides what comes back (a customer gets only their own
// appointments and profile, whatever this code asks for).
import type { Appointment, AppointmentStatus, Dataset, Notification, Profile, Salon, Style, StyleOption, Stylist, TimeOff, WorkingHours } from "../domain/types";
import { supabase } from "../supabase/client";
import type { Busy } from "../domain/booking";
import type { HoursDraft, NewBooking, OptionDraft, Store, StyleDraft, StylistDraft, VisitSettings } from "./store";

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
const hhmm = (t: string) => t.slice(0, 5); // "09:00:00" from the database

export class SupabaseStore implements Store {
  mode = "supabase" as const;

  async load(): Promise<Dataset> {
    const sb = supabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error("Please sign in again.");
    const [salon, people, styles, options, stylists, hours, timeOff, appointments, notifications] = await Promise.all([
      rows<Salon>(sb.from("salon").select("*").limit(1)),
      rows<Profile>(sb.from("profiles").select("*").order("full_name")),
      rows<Style>(sb.from("styles").select("*").order("sort")),
      rows<StyleOption>(sb.from("style_options").select("*").order("sort")),
      rows<Stylist>(sb.from("stylists").select("*").order("sort")),
      rows<WorkingHours>(sb.from("working_hours").select("*")),
      rows<TimeOff>(sb.from("time_off").select("*").order("starts_at")),
      rows<Appointment>(sb.from("appointments").select("*").order("starts_at")),
      rows<Notification>(sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)),
    ]);
    const me = people.find((p) => p.id === auth.user.id);
    if (!salon[0]) throw new Error("The salon isn't set up yet. See docs/setup.md.");
    if (!me) throw new Error("Your profile is missing. Please sign out and in again.");
    return {
      salon: salon[0], me, people,
      styles: styles.map((s) => ({ ...s, price: Number(s.price) })),
      options: options.map((o) => ({ ...o, extra_price: Number(o.extra_price) })),
      stylists, timeOff,
      hours: hours.map((h) => ({ ...h, starts: hhmm(h.starts), ends: hhmm(h.ends) })),
      appointments: appointments.map((a) => ({ ...a, price: Number(a.price) })),
      notifications,
    };
  }

  async signOut() { await supabase().auth.signOut(); }

  async markRead(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
    if (error) throw new Error(error.message);
  }

  async busyTimes(from: string, to: string): Promise<Busy[]> {
    const { data, error } = await supabase().rpc("busy_times", { p_from: from, p_to: to });
    if (error) throw new Error(error.message);
    return (data ?? []) as Busy[];
  }

  // The server works out the price and time and checks every rule (book_appointment).
  async book(b: NewBooking): Promise<Appointment> {
    const { data, error } = await supabase().rpc("book_appointment", {
      p_style: b.styleId, p_options: b.optionIds, p_stylist: b.stylistId, p_starts_at: b.startsAt, p_note: b.note || null,
      p_address: b.address.address, p_city: b.address.city, p_zip: b.address.zip,
    });
    if (error) throw new Error(error.message);
    const a = data as Appointment;
    return { ...a, price: Number(a.price) };
  }

  async cancel(id: string) {
    const { error } = await supabase().rpc("cancel_appointment", { p_id: id });
    if (error) throw new Error(error.message);
  }

  // The salon's tools: plain updates, which Row Level Security allows only for admins.
  async setStatus(id: string, status: Exclude<AppointmentStatus, "pending">) {
    const { error } = await supabase().from("appointments").update({ status, ...(status === "cancelled" ? { cancelled_by: "salon" } : {}) }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async reschedule(id: string, startsAt: string, stylistId: string) {
    const sb = supabase();
    const { data, error } = await sb.from("appointments").select("starts_at, ends_at").eq("id", id).single();
    if (error) throw new Error(error.message);
    const minutes = (Date.parse(data.ends_at) - Date.parse(data.starts_at)) / 60000;
    const ends = new Date(Date.parse(startsAt) + minutes * 60000).toISOString();
    // The database refuses an overlap for that stylist (appointments_no_overlap).
    const { error: e } = await sb.from("appointments").update({ starts_at: startsAt, ends_at: ends, stylist_id: stylistId }).eq("id", id);
    if (e) throw new Error(/no_overlap/.test(e.message) ? "That time is no longer free. Please pick another." : e.message);
  }

  async saveStyle(style: StyleDraft, options: OptionDraft[]): Promise<string> {
    const sb = supabase();
    const { data, error } = await sb.from("styles").upsert(style).select("id").single();
    if (error) throw new Error(error.message);
    const { error: e } = await sb.rpc("save_style_options", { p_style: data.id, p_options: options.filter((o) => o.label.trim()) });
    if (e) throw new Error(e.message);
    return data.id as string;
  }

  async saveStylist(stylist: StylistDraft, hours: HoursDraft[]): Promise<string> {
    const sb = supabase();
    const { data, error } = await sb.from("stylists").upsert(stylist).select("id").single();
    if (error) throw new Error(error.message);
    const { error: e } = await sb.rpc("save_working_hours", { p_stylist: data.id, p_hours: hours });
    if (e) throw new Error(e.message);
    return data.id as string;
  }

  async addTimeOff(t: Omit<TimeOff, "id">) {
    const { error } = await supabase().from("time_off").insert(t);
    if (error) throw new Error(error.message);
  }

  async removeTimeOff(id: string) {
    const { error } = await supabase().from("time_off").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async linkLogin(stylistId: string, email: string) {
    const { error } = await supabase().rpc("link_stylist_login", { p_stylist: stylistId, p_email: email });
    if (error) throw new Error(error.message);
  }

  async linkProfile(stylistId: string, profileId: string) {
    const { error } = await supabase().rpc("link_stylist_profile", { p_stylist: stylistId, p_profile: profileId });
    if (error) throw new Error(error.message);
  }

  async declineJoin(profileId: string) {
    const { error } = await supabase().from("profiles").update({ wants_stylist: false }).eq("id", profileId);
    if (error) throw new Error(error.message);
  }

  async unlinkLogin(stylistId: string) {
    const { error } = await supabase().rpc("unlink_stylist_login", { p_stylist: stylistId });
    if (error) throw new Error(error.message);
  }

  async markJob(id: string, status: "completed" | "no_show") {
    const { error } = await supabase().rpc("mark_job", { p_id: id, p_status: status });
    if (error) throw new Error(error.message);
  }

  async removeStylist(id: string) {
    const { error } = await supabase().rpc("remove_stylist", { p_stylist: id });
    if (error) throw new Error(error.message);
  }

  async saveVisitSettings(v: VisitSettings) {
    const sb = supabase();
    const { data, error } = await sb.from("salon").select("id").limit(1).single();
    if (error) throw new Error(error.message);
    const { error: e } = await sb.from("salon").update({ service_zips: v.service_zips, travel_minutes: v.travel_minutes }).eq("id", data.id);
    if (e) throw new Error(/check/.test(e.message) ? "Use the first three digits of each ZIP code, for example 200." : e.message);
  }
}
