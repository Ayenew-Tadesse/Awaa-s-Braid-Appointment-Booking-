import { describe, expect, it } from "vitest";
import { addDays, at, formatDuration, formatMoney, formatSlot, localDay, tzOffsetMinutes, weekdayOf } from "./time";

const TZ = "Africa/Addis_Ababa";

describe("salon time", () => {
  it("knows Addis Ababa is three hours ahead of UTC", () => {
    expect(tzOffsetMinutes(new Date("2026-10-05T12:00:00Z"), TZ)).toBe(180);
  });
  it("turns a salon-local day and time into the real moment", () => {
    expect(at("2026-10-05", "09:30", TZ).toISOString()).toBe("2026-10-05T06:30:00.000Z");
    expect(at("2026-10-05", "00:00", TZ).toISOString()).toBe("2026-10-04T21:00:00.000Z");
  });
  it("uses the salon's date, not UTC's, late in the evening", () => {
    expect(localDay(new Date("2026-10-05T22:30:00Z"), TZ)).toBe("2026-10-06");
  });
  it("adds days across months and knows weekdays", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(weekdayOf("2026-10-04")).toBe(0); // a Sunday
  });
  it("shows times and money the salon's way", () => {
    expect(formatSlot("2026-10-06T06:00:00Z", "2026-10-06T10:00:00Z", TZ)).toBe("Tue, Oct 6 · 9:00 AM – 1:00 PM");
    expect(formatDuration(270)).toBe("4 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatMoney(2500)).toBe("ETB 2,500");
  });
});
