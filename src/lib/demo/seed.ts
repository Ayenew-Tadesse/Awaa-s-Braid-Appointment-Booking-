// The demo salon: Awaa Braids with its styles, stylists, customers and a
// realistic diary around today. Every person here is fictional; prices are
// sample prices. Built fresh relative to "now", so the diary always has
// past, today's and upcoming appointments.
import type { Appointment, AppointmentStatus, OptionKind, Profile, Salon, Style, StyleOption, Stylist, TimeOff, WorkingHours } from "../domain/types";
import { addDays, at, localDay, weekdayOf } from "../domain/time";

export const DEMO_PASSWORD = "demo1234";

export type DemoAccount = { email: string; profile_id: string; label: string };
export type World = {
  /** The salon-local day it was built for (the demo is rebuilt on a new day). */
  builtOn: string;
  salon: Salon;
  profiles: Profile[];
  styles: Style[];
  options: StyleOption[];
  stylists: Stylist[];
  hours: WorkingHours[];
  timeOff: TimeOff[];
  appointments: Appointment[];
  accounts: DemoAccount[];
};

// Stable ids that read as what they are (and are valid UUIDs).
const id = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const TZ = "Africa/Addis_Ababa";

const SALON: Salon = {
  id: id("5a", 1), name: "Awaa Braids", tagline: "Braids done with care, booked in a minute.",
  phone: "+251 900 000 000", address: "Bole, near Edna Mall (demo address)", city: "Addis Ababa",
  timezone: TZ, currency: "ETB", slot_minutes: 30, min_notice_hours: 2, booking_window_days: 60, cancel_hours: 24,
};

type StyleSeed = [name: string, category: Style["category"], minutes: number, price: number, description: string, options: "braids" | "cornrows" | "none"];
const STYLES: StyleSeed[] = [
  ["Knotless braids", "braids", 240, 2500, "Light, flat braids that start with your own hair, so they're gentle on the scalp.", "braids"],
  ["Box braids", "braids", 210, 2200, "Classic square-parted braids that last for weeks.", "braids"],
  ["Fulani braids", "braids", 180, 2300, "Cornrows at the front and braids at the back, with beads if you like.", "braids"],
  ["Passion twists", "twists", 180, 2000, "Soft, bohemian two-strand twists.", "braids"],
  ["Cornrows", "cornrows", 90, 800, "Neat rows close to the scalp, straight back or in a design.", "cornrows"],
  ["Kids' braids", "kids", 90, 700, "Gentle styles for children under 12, with breaks when they need them.", "cornrows"],
  ["Takedown and wash", "other", 60, 400, "We take out your old braids and wash your hair.", "none"],
];
const BRAID_OPTIONS: [OptionKind, string, number, number][] = [
  ["size", "Small", 60, 800], ["size", "Medium", 0, 0], ["size", "Large", -45, -300],
  ["length", "Shoulder", 0, 0], ["length", "Mid-back", 45, 400], ["length", "Waist", 90, 800],
];
const CORNROW_OPTIONS: [OptionKind, string, number, number][] = [
  ["extra", "Straight back", 0, 0], ["extra", "Design", 30, 300],
];

const STYLISTS: [string, string, number[]][] = [
  // name, bio, weekdays off
  ["Selam", "Knotless and box braids; very gentle hands.", [0]],
  ["Meron", "Fulani braids and designs.", [0, 2]],
  ["Hiwot", "Twists, cornrows and kids' styles.", [4]],
];

// Customers (fictional). The first is the demo customer account.
const CUSTOMERS: [string, string][] = [
  ["Hana Bekele", "0911 000 101"], ["Liya Tesfaye", "0911 000 102"], ["Ruth Alemu", "0911 000 103"],
  ["Saba Girma", "0911 000 104"], ["Eden Mulugeta", "0911 000 105"], ["Mahlet Kebede", "0911 000 106"],
  ["Bethlehem Haile", "0911 000 107"], ["Yordanos Tadesse", "0911 000 108"],
];

export function buildWorld(now = new Date()): World {
  const today = localDay(now, TZ);
  const created = new Date(now.getTime() - 40 * 86400000).toISOString();

  const admin: Profile = { id: id("ad", 1), role: "admin", full_name: "Salon Manager", phone: "0911 000 100", created_at: created };
  const customers: Profile[] = CUSTOMERS.map(([full_name, phone], i) => ({ id: id("c0", i + 1), role: "customer", full_name, phone, created_at: created }));

  const styles: Style[] = STYLES.map(([name, category, duration_minutes, price, description], i) => ({
    id: id("57", i + 1), name, description, category, image_url: null, duration_minutes, price, active: true, sort: i + 1,
  }));
  const options: StyleOption[] = [];
  STYLES.forEach(([, , , , , kind], i) => {
    const list = kind === "braids" ? BRAID_OPTIONS : kind === "cornrows" ? CORNROW_OPTIONS : [];
    list.forEach(([k, label, extra_minutes, extra_price], j) =>
      options.push({ id: id("0b", (i + 1) * 100 + j + 1), style_id: styles[i].id, kind: k, label, extra_minutes, extra_price, sort: j + 1 }));
  });

  const stylists: Stylist[] = STYLISTS.map(([name, bio], i) => ({ id: id("51", i + 1), name, bio, active: true, sort: i + 1 }));
  const hours: WorkingHours[] = [];
  STYLISTS.forEach(([, , off], i) => {
    for (let d = 0; d < 7; d++) {
      if (off.includes(d)) continue;
      // One long block: braiding takes hours, so breaks fit around each client.
      hours.push({ id: id("40", i * 10 + d + 1), stylist_id: stylists[i].id, weekday: d, starts: "09:00", ends: "19:00" });
    }
  });

  // The diary: [days from today, start, stylist, customer, style, option labels, status].
  // Only on days the stylist works, inside their hours, never overlapping.
  type Seed = [number, string, number, number, number, string[], AppointmentStatus];
  const DIARY: Seed[] = [
    [-9, "09:00", 0, 0, 0, ["Medium", "Mid-back"], "completed"],
    [-6, "14:00", 2, 0, 4, ["Straight back"], "completed"],
    [-5, "09:00", 1, 1, 2, ["Medium", "Shoulder"], "completed"],
    [-4, "14:00", 0, 2, 1, ["Large", "Shoulder"], "no_show"],
    [-3, "09:30", 2, 3, 3, ["Medium", "Shoulder"], "completed"],
    [-2, "10:00", 1, 4, 4, ["Design"], "cancelled"],
    [-1, "14:00", 0, 5, 6, [], "completed"],
    [0, "09:00", 0, 6, 0, ["Medium", "Shoulder"], "confirmed"],
    [0, "10:00", 2, 7, 5, ["Straight back"], "confirmed"],
    [0, "14:30", 1, 1, 4, ["Design"], "pending"],
    [0, "15:00", 2, 3, 3, ["Large", "Shoulder"], "pending"],
    [3, "09:00", 0, 0, 0, ["Small", "Mid-back"], "confirmed"],
    [4, "14:00", 1, 2, 2, ["Medium", "Waist"], "pending"],
    [5, "10:00", 2, 5, 4, ["Straight back"], "confirmed"],
    [8, "14:00", 2, 0, 3, ["Medium", "Shoulder"], "pending"],
    [9, "09:00", 0, 4, 1, ["Medium", "Mid-back"], "pending"],
  ];
  const appointments: Appointment[] = [];
  DIARY.forEach(([days, start, si, ci, sti, labels, status], i) => {
    // A day the stylist is off moves to the next day they work.
    let day = addDays(today, days);
    while (STYLISTS[si][2].includes(weekdayOf(day))) day = addDays(day, days < 0 ? -1 : 1);
    const style = styles[sti];
    const chosen = options.filter((o) => o.style_id === style.id && labels.includes(o.label));
    const minutes = Math.max(15, style.duration_minutes + chosen.reduce((a, o) => a + o.extra_minutes, 0));
    const startsAt = at(day, start, TZ);
    appointments.push({
      id: id("a1", i + 1), customer_id: customers[ci].id, stylist_id: stylists[si].id, style_id: style.id, style_name: style.name,
      options: chosen.map((o) => ({ id: o.id, kind: o.kind, label: o.label })),
      starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + minutes * 60000).toISOString(),
      price: style.price + chosen.reduce((a, o) => a + o.extra_price, 0), status, note: null,
      cancelled_by: status === "cancelled" ? "customer" : null, created_at: created,
    });
  });

  // Meron is away for a training day next week.
  let away = addDays(today, 6);
  while (STYLISTS[1][2].includes(weekdayOf(away))) away = addDays(away, 1);
  const timeOff: TimeOff[] = [{ id: id("70", 1), stylist_id: stylists[1].id, starts_at: at(away, "09:00", TZ).toISOString(), ends_at: at(away, "19:00", TZ).toISOString(), reason: "Training day" }];

  return {
    builtOn: today, salon: SALON, profiles: [admin, ...customers], styles, options, stylists, hours, timeOff, appointments,
    accounts: [
      { email: "customer@example.com", profile_id: customers[0].id, label: "Customer" },
      { email: "admin@example.com", profile_id: admin.id, label: "Salon admin" },
    ],
  };
}
