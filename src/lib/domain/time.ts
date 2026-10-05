// Times and money as the salon sees them: everything is shown in the salon's
// time zone (US Eastern for the DC area), whatever the phone's own setting,
// with daylight saving handled.

/** The language dates and times are written in ("en-US" or "am"); the app sets it from the chosen language. */
let dateLocale = "en-US";
export const setDateLocale = (l: string) => { dateLocale = l; };
export const getDateLocale = () => dateLocale;

/** The time zone's offset from UTC at that moment, in minutes (New York in summer: -240). */
export function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The salon's calendar date at that moment: "2026-10-05". */
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** A day plus some days: addDays("2026-10-05", 2) = "2026-10-07". */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Weekday of a calendar day (0 = Sunday). */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** The moment a salon-local day and time happens: at("2026-10-05", "09:30", tz). */
export function at(day: string, hhmm: string, timeZone: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m));
  const first = new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60000);
  // Once more, in case the offset differs at the real moment (daylight saving).
  return new Date(guess.getTime() - tzOffsetMinutes(first, timeZone) * 60000);
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(dateLocale, { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
export function formatDay(iso: string, timeZone: string, opts: { weekday?: "short" | "long"; year?: boolean } = {}): string {
  return new Intl.DateTimeFormat(dateLocale, { timeZone, weekday: opts.weekday ?? "short", month: "short", day: "numeric", ...(opts.year ? { year: "numeric" } : {}) }).format(new Date(iso));
}
/** "Tue, Oct 6 · 9:00 AM – 1:00 PM" */
export function formatSlot(startIso: string, endIso: string, timeZone: string): string {
  return `${formatDay(startIso, timeZone)} · ${formatTime(startIso, timeZone)} – ${formatTime(endIso, timeZone)}`;
}

/** "4 h 30 min", "45 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/** "$220", "$1,250", "$45.50" (cents only when there are some). */
export function formatMoney(amount: number, currency = "USD"): string {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(amount);
}
