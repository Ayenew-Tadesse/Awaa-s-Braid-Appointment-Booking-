import { describe, expect, it } from "vitest";
import { buildWorld } from "./seed";
import { addDays, at, localDay, weekdayOf } from "../domain/time";
import { isOpen } from "../domain/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Every day of a week, so weekends and days off are all covered.
const mondays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i, 9)));

describe("the demo salon", () => {
  it.each(mondays)("keeps every appointment inside the stylist's hours (built %s)", (now) => {
    const w = buildWorld(now);
    const tz = w.salon.timezone;
    for (const a of w.appointments) {
      const day = localDay(new Date(a.starts_at), tz);
      const fits = w.hours.some((h) => h.stylist_id === a.stylist_id && h.weekday === weekdayOf(day)
        && at(day, h.starts, tz).getTime() <= Date.parse(a.starts_at) && at(day, h.ends, tz).getTime() >= Date.parse(a.ends_at));
      expect(fits, `${a.style_name} on ${day}`).toBe(true);
    }
  });

  it.each(mondays)("never double-books a stylist (built %s)", (now) => {
    const open = buildWorld(now).appointments.filter(isOpen);
    for (const a of open) for (const b of open) {
      if (a === b || a.stylist_id !== b.stylist_id) continue;
      expect(Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(b.starts_at) < Date.parse(a.ends_at), `${a.id} and ${b.id}`).toBe(false);
    }
  });

  it("has past, today's and upcoming appointments, and the demo customer has some of each", () => {
    const now = new Date(Date.UTC(2026, 9, 6, 6)); // a Tuesday morning in Addis Ababa
    const w = buildWorld(now);
    const today = localDay(now, w.salon.timezone);
    const days = w.appointments.map((a) => localDay(new Date(a.starts_at), w.salon.timezone));
    expect(days.some((d) => d < today)).toBe(true);
    expect(days.filter((d) => d === today).length).toBeGreaterThanOrEqual(2);
    expect(days.some((d) => d > addDays(today, 2))).toBe(true);
    const mine = w.appointments.filter((a) => a.customer_id === w.accounts[0].profile_id);
    expect(mine.some((a) => a.status === "completed")).toBe(true);
    expect(mine.some((a) => isOpen(a) && Date.parse(a.starts_at) > now.getTime())).toBe(true);
  });

  it("prices and times each appointment from its style and options", () => {
    const w = buildWorld(new Date(Date.UTC(2026, 9, 6, 6)));
    for (const a of w.appointments) {
      const s = w.styles.find((x) => x.id === a.style_id)!;
      const o = w.options.filter((x) => a.options.some((y) => y.id === x.id));
      expect(a.price).toBe(s.price + o.reduce((t, x) => t + x.extra_price, 0));
      expect((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000).toBe(Math.max(15, s.duration_minutes + o.reduce((t, x) => t + x.extra_minutes, 0)));
    }
  });

  it("uses valid, unique ids (the same ones work in a real database)", () => {
    const w = buildWorld();
    const ids = [w.salon, ...w.profiles, ...w.styles, ...w.options, ...w.stylists, ...w.hours, ...w.timeOff, ...w.appointments].map((x) => x.id);
    expect(ids.every((x) => UUID.test(x))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has one demo customer and one demo admin account", () => {
    const w = buildWorld();
    expect(w.accounts.map((a) => w.profiles.find((p) => p.id === a.profile_id)?.role)).toEqual(["customer", "admin"]);
  });
});
