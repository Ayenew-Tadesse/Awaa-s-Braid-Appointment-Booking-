// What the screens can ask for and do. Two stores implement it:
//   SupabaseStore: the real salon (Row Level Security decides what you see);
//   DemoStore: the demo salon kept in this browser, with the same rules (visibility.ts).
import type { Address, Busy } from "../domain/booking";
import type { Appointment, AppointmentStatus, Dataset, Salon, Style, StyleOption, Stylist, TimeOff, WorkingHours } from "../domain/types";

/** address: where the stylist goes (saved on the profile for next time). */
export type NewBooking = { styleId: string; optionIds: string[]; stylistId: string | null; startsAt: string; note: string; address: Address };
/** The home-visit settings the salon can change. */
export type VisitSettings = Pick<Salon, "service_zips" | "travel_minutes">;
/** A style as the salon edits it (no id = a new style), with its options in order. */
export type StyleDraft = Omit<Style, "id"> & { id?: string };
export type OptionDraft = Pick<StyleOption, "kind" | "label" | "extra_minutes" | "extra_price">;
export type StylistDraft = Omit<Stylist, "id"> & { id?: string };
export type HoursDraft = Pick<WorkingHours, "weekday" | "starts" | "ends">;

export interface Store {
  mode: "demo" | "supabase";
  /** Everything the signed-in person may see. */
  load(): Promise<Dataset>;
  signOut(): Promise<void>;
  /** When stylists are busy between two moments (no one's name or details). */
  busyTimes(from: string, to: string): Promise<Busy[]>;
  /** Book as the signed-in customer; it waits for the salon to confirm. */
  book(b: NewBooking): Promise<Appointment>;
  /** Cancel your own appointment (a waiting request any time; a confirmed one up to the salon's notice). */
  cancel(id: string): Promise<void>;

  /** Mark your own notifications as read. */
  markRead(ids: string[]): Promise<void>;

  // The salon (admins only; the database refuses everyone else).
  /** Confirm, decline or cancel (cancelled), mark done (completed) or missed (no_show). */
  setStatus(id: string, status: Exclude<AppointmentStatus, "pending">): Promise<void>;
  /** Move an appointment to another free time and/or stylist (same length). */
  reschedule(id: string, startsAt: string, stylistId: string): Promise<void>;
  /** Add or change a style and replace its options; returns its id. */
  saveStyle(style: StyleDraft, options: OptionDraft[]): Promise<string>;
  /** Add or change a stylist and replace their week; returns their id. */
  saveStylist(stylist: StylistDraft, hours: HoursDraft[]): Promise<string>;
  addTimeOff(t: Omit<TimeOff, "id">): Promise<void>;
  removeTimeOff(id: string): Promise<void>;
  /** Link a stylist to the login that uses this email (it becomes a stylist account); unlink makes it a customer again. */
  linkLogin(stylistId: string, email: string): Promise<void>;
  unlinkLogin(stylistId: string): Promise<void>;
  /** A stylist marks their own confirmed, started job done (completed) or missed (no_show). */
  markJob(id: string, status: "completed" | "no_show"): Promise<void>;
  /** Take a stylist off the team (refused while they have upcoming appointments). */
  removeStylist(id: string): Promise<void>;
  /** The ZIP codes we travel to and the travel time between visits. */
  saveVisitSettings(v: VisitSettings): Promise<void>;
}

/** A friendly message for any store error (database refusals, network, validation). */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/row-level security|permission denied|42501/i.test(m)) return "You don't have permission to do that.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "You're offline or the salon can't be reached. Please try again.";
  return m || "Something went wrong.";
}
