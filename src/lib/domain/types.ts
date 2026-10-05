// The salon's data, as stored (supabase/migrations) and as the screens use it.

export type Role = "customer" | "admin";
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type StyleCategory = "braids" | "cornrows" | "twists" | "locs" | "kids" | "other";
export type OptionKind = "size" | "length" | "extra";

export type Salon = {
  id: string; name: string; tagline: string | null; phone: string | null; address: string | null; city: string | null;
  timezone: string; currency: string; slot_minutes: number; min_notice_hours: number; booking_window_days: number; cancel_hours: number;
  /** Home visits: the ZIP codes we travel to (their first three digits), and the time kept free after each visit to travel. */
  service_zips: string[]; travel_minutes: number;
};
/** address, city and zip: the customer's home, saved from their last booking (only they and the salon see it). */
export type Profile = { id: string; role: Role; full_name: string; phone: string | null; address: string | null; city: string | null; zip: string | null; created_at: string };
export type Style = {
  id: string; name: string; description: string | null; category: StyleCategory; image_url: string | null;
  duration_minutes: number; price: number; active: boolean; sort: number;
};
export type StyleOption = { id: string; style_id: string; kind: OptionKind; label: string; extra_minutes: number; extra_price: number; sort: number };
export type Stylist = { id: string; name: string; bio: string | null; active: boolean; sort: number };
/** weekday 0 = Sunday; times "HH:MM" in the salon's time zone. */
export type WorkingHours = { id: string; stylist_id: string; weekday: number; starts: string; ends: string };
export type TimeOff = { id: string; stylist_id: string; starts_at: string; ends_at: string; reason: string | null };
export type Appointment = {
  id: string; customer_id: string; stylist_id: string; style_id: string; style_name: string;
  options: { id: string; kind: OptionKind; label: string }[];
  starts_at: string; ends_at: string; price: number; status: AppointmentStatus; note: string | null;
  cancelled_by: "customer" | "salon" | null; created_at: string;
  /** Where the stylist goes (as it was when booked). */
  visit_address: string | null; visit_city: string | null; visit_zip: string | null;
  /** The end plus travel time: the stylist isn't free for another visit until then. */
  busy_until?: string;
};

export type NotificationKind = "booked" | "confirmed" | "moved" | "declined" | "cancelled_by_salon" | "cancelled_by_customer";
/** Made by the database when an appointment changes; the app picks the words (in the reader's language). */
export type Notification = {
  id: string; user_id: string; kind: NotificationKind; appointment_id: string | null;
  data: { style?: string; starts_at?: string; ends_at?: string; customer?: string; stylist?: string };
  created_at: string; read_at: string | null;
};

/** Everything the signed-in person may see (the database's rules decide; the demo applies the same rules). */
export type Dataset = {
  salon: Salon;
  me: Profile;
  styles: Style[];
  options: StyleOption[];
  stylists: Stylist[];
  hours: WorkingHours[];
  /** The salon only. */
  timeOff: TimeOff[];
  /** A customer's own; all of them for the salon. */
  appointments: Appointment[];
  /** Just you for a customer; every customer for the salon. */
  people: Profile[];
  /** Your own, newest first. */
  notifications: Notification[];
};

/** Open appointments hold their time; the others don't. */
export const isOpen = (a: Pick<Appointment, "status">) => a.status === "pending" || a.status === "confirmed";
