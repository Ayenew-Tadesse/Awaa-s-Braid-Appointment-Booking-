// The real salon, through Supabase. Every query runs as the signed-in person,
// so Row Level Security decides what comes back (a customer gets only their own
// appointments and profile, whatever this code asks for).
import type { Appointment, Dataset, Profile, Salon, Style, StyleOption, Stylist, TimeOff, WorkingHours } from "../domain/types";
import { supabase } from "../supabase/client";
import type { Store } from "./store";

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
    const [salon, people, styles, options, stylists, hours, timeOff, appointments] = await Promise.all([
      rows<Salon>(sb.from("salon").select("*").limit(1)),
      rows<Profile>(sb.from("profiles").select("*").order("full_name")),
      rows<Style>(sb.from("styles").select("*").order("sort")),
      rows<StyleOption>(sb.from("style_options").select("*").order("sort")),
      rows<Stylist>(sb.from("stylists").select("*").order("sort")),
      rows<WorkingHours>(sb.from("working_hours").select("*")),
      rows<TimeOff>(sb.from("time_off").select("*").order("starts_at")),
      rows<Appointment>(sb.from("appointments").select("*").order("starts_at")),
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
    };
  }

  async signOut() { await supabase().auth.signOut(); }
}
