// The guided demo tour: eight stops, the customer's side then the salon's. Each
// stop says which demo account to be, which page to show and what to point at
// (a CSS selector). The words are in the dictionaries under tour.<key>.title /
// tour.<key>.body. Where you are in the tour lives in sessionStorage, so it
// survives the reload that switching demo accounts needs, and ends with the tab.
import type { Role } from "@/lib/domain/types";

export type TourStop = { role: Role; path: string; target: string; key: string };

export const TOUR: TourStop[] = [
  { role: "customer", path: "/app", target: "[data-next]", key: "next" },
  { role: "customer", path: "/app/book", target: "[data-booking] ul", key: "book" },
  { role: "customer", path: "/app/notifications", target: "#main ul", key: "notes" },
  { role: "admin", path: "/app", target: "[data-requests]", key: "requests" },
  { role: "admin", path: "/app/calendar", target: "[data-cal-stylist]", key: "calendar" },
  { role: "admin", path: "/app/salon/styles", target: "[data-manage-style]", key: "styles" },
  { role: "admin", path: "/app/salon/team", target: "[data-manage-stylist]", key: "team" },
  { role: "admin", path: "/app/salon/reports", target: "[data-week-bars]", key: "reports" },
];

/** The demo account each role uses on the tour. */
export const TOUR_ACCOUNTS: Record<Role, string> = { customer: "customer@example.com", admin: "admin@example.com" };

const KEY = "awaa_tour";
const listeners = new Set<() => void>();
export const subscribeTour = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** The stop the tour is on (0–7), or null when there's no tour. */
export function tourStop(): number | null {
  try {
    const v = sessionStorage.getItem(KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isInteger(n) && n >= 0 && n < TOUR.length ? n : null;
  } catch { return null; }
}
/** Go to a stop (null ends the tour). */
export function setTourStop(n: number | null) {
  try { if (n === null || n < 0 || n >= TOUR.length) sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY, String(n)); } catch { /* no tour without storage */ }
  listeners.forEach((f) => f());
}
