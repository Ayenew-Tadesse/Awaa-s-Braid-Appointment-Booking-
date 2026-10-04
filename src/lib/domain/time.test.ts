import { describe, expect, it } from "vitest";
import { addDays, at, formatDuration, formatMoney, formatSlot, localDay, tzOffsetMinutes, weekdayOf } from "./time";

const TZ = "America/New_York"; // the Washington, DC area

describe("salon time", () => {
  it("knows Eastern Time's offset, summer and winter", () => {
    expect(tzOffsetMinutes(new Date("2026-07-05T12:00:00Z"), TZ)).toBe(-240);
    expect(tzOffsetMinutes(new Date("2026-12-05T12:00:00Z"), TZ)).toBe(-300);
    expect(tzOffsetMinutes(new Date("2026-10-05T12:00:00Z"), "Africa/Addis_Ababa")).toBe(180);
  });
  it("turns a salon-local day and time into the real moment", () => {
    expect(at("2026-10-05", "09:30", TZ).toISOString()).toBe("2026-10-05T13:30:00.000Z");
    expect(at("2026-12-05", "09:30", TZ).toISOString()).toBe("2026-12-05T14:30:00.000Z");
  });
  it("keeps 9:00 AM at 9:00 AM on the days the clocks change", () => {
    // Spring forward (Mar 8, 2026) and fall back (Nov 1, 2026).
    expect(at("2026-03-07", "09:00", TZ).toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(at("2026-03-08", "09:00", TZ).toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(at("2026-10-31", "09:00", TZ).toISOString()).toBe("2026-10-31T13:00:00.000Z");
    expect(at("2026-11-01", "09:00", TZ).toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });
  it("uses the salon's date, not UTC's, late in the evening", () => {
    expect(localDay(new Date("2026-10-06T02:30:00Z"), TZ)).toBe("2026-10-05");
  });
  it("adds days across months and knows weekdays", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(weekdayOf("2026-10-04")).toBe(0); // a Sunday
  });
  it("shows times and money the salon's way", () => {
    expect(formatSlot("2026-10-06T13:00:00Z", "2026-10-06T17:00:00Z", TZ)).toBe("Tue, Oct 6 · 9:00 AM – 1:00 PM");
    expect(formatDuration(270)).toBe("4 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatMoney(220)).toBe("$220");
    expect(formatMoney(1250)).toBe("$1,250");
    expect(formatMoney(45.5)).toBe("$45.50");
  });
});
