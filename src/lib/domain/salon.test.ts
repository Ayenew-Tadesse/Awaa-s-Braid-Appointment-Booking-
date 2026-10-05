import { describe, expect, it } from "vitest";
import { hoursProblem, salonActions, salonReport, styleProblem } from "./salon";
import { freeSlots } from "./booking";
import { at, formatTime } from "./time";
import { buildWorld } from "../demo/seed";
import type { Appointment } from "./types";

const NOW = new Date(Date.UTC(2026, 9, 6, 11)); // Tue Oct 6, 7:00 AM in the DC area
const w = buildWorld(NOW);
const tz = w.salon.timezone;
const appt = (status: Appointment["status"], hoursAhead: number): Appointment =>
  ({ ...w.appointments[0], status, starts_at: new Date(NOW.getTime() + hoursAhead * 3600000).toISOString() });

describe("what the salon can do with an appointment", () => {
  it("a request: confirm, decline or move; once its time comes, done or missed", () => {
    expect(salonActions(appt("pending", 5), NOW)).toEqual(["confirm", "decline", "reschedule"]);
    expect(salonActions(appt("pending", -1), NOW)).toEqual(["done", "no_show", "decline"]);
  });
  it("a confirmed one: move or cancel; once started, done or missed", () => {
    expect(salonActions(appt("confirmed", 5), NOW)).toEqual(["reschedule", "cancel"]);
    expect(salonActions(appt("confirmed", -1), NOW)).toEqual(["done", "no_show"]);
  });
  it("finished ones are final", () => {
    for (const s of ["completed", "cancelled", "no_show"] as const) expect(salonActions(appt(s, -5), NOW)).toEqual([]);
  });
});

describe("moving an appointment", () => {
  it("the salon may use times inside the usual 2 hours' notice, but not the past", () => {
    const day = "2026-10-06";
    const base = { salon: w.salon, stylists: w.stylists, hours: w.hours, busy: [], day, minutes: 60, now: at(day, "10:10", tz) };
    expect(formatTime(freeSlots(base)[0].startsAt, tz)).toBe("12:30 PM");
    expect(formatTime(freeSlots({ ...base, forSalon: true })[0].startsAt, tz)).toBe("10:30 AM");
  });
});

describe("working hours and styles before saving", () => {
  it("need real times, ends after starts, and no overlaps on a day", () => {
    expect(hoursProblem([{ weekday: 1, starts: "09:00", ends: "19:00" }])).toBeNull();
    expect(hoursProblem([{ weekday: 1, starts: "09:00", ends: "13:00" }, { weekday: 1, starts: "14:00", ends: "19:00" }])).toBeNull();
    expect(hoursProblem([{ weekday: 1, starts: "9", ends: "19:00" }])).toBe("Use times like 09:00.");
    expect(hoursProblem([{ weekday: 1, starts: "19:00", ends: "09:00" }])).toBe("Each block must end after it starts.");
    expect(hoursProblem([{ weekday: 2, starts: "09:00", ends: "14:00" }, { weekday: 2, starts: "13:00", ends: "19:00" }])).toBe("Two blocks on the same day overlap.");
  });
  it("styles need a name, a sensible time and no negative price", () => {
    expect(styleProblem({ name: "Bob braids", duration_minutes: 120, price: 150 })).toBeNull();
    expect(styleProblem({ name: " ", duration_minutes: 120, price: 150 })).toMatch(/name/);
    expect(styleProblem({ name: "x", duration_minutes: 5, price: 150 })).toMatch(/15 minutes/);
    expect(styleProblem({ name: "x", duration_minutes: 60, price: -1 })).toMatch(/negative/);
  });
});

describe("the salon's numbers", () => {
  const r = salonReport(w.appointments, NOW, tz);
  it("count bookings for the last 8 weeks, this week last", () => {
    expect(r.weeks.length).toBe(8);
    expect(r.weeks.at(-1)!.start).toBe("2026-10-05"); // the Monday of this week
    const kept = w.appointments.filter((a) => a.status !== "cancelled" && a.starts_at >= at("2026-08-17", "00:00", tz).toISOString() && a.starts_at < at("2026-10-12", "00:00", tz).toISOString());
    expect(r.weeks.reduce((s, x) => s + x.booked, 0)).toBe(kept.length);
  });
  it("rank styles, and work out no-show and cancellation rates", () => {
    expect(r.popular[0].count).toBeGreaterThanOrEqual(r.popular.at(-1)!.count);
    const past = w.appointments.filter((a) => Date.parse(a.starts_at) <= NOW.getTime());
    const fin = past.filter((a) => a.status === "completed" || a.status === "no_show");
    expect(r.noShowRate).toBeCloseTo(fin.filter((a) => a.status === "no_show").length / fin.length);
    expect(r.cancelRate).toBeCloseTo(past.filter((a) => a.status === "cancelled").length / past.length);
  });
  it("add up what was earned and what's expected", () => {
    expect(r.earned30).toBe(w.appointments.filter((a) => a.status === "completed").reduce((s, a) => s + a.price, 0));
    expect(r.expected7).toBeGreaterThan(0);
  });
  it("say nothing (not 0%) when there is nothing to count", () => {
    expect(salonReport([], NOW, tz)).toMatchObject({ noShowRate: null, cancelRate: null, earned30: 0, expected7: 0, popular: [] });
  });
});
