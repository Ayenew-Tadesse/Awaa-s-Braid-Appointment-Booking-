import { describe, expect, it } from "vitest";
import { addressProblem, areaLabel, bookableDays, busyFrom, cancelRule, freeSlots, inServiceArea, mapsUrl, optionsProblem, quote } from "./booking";
import { at, formatTime } from "./time";
import type { Appointment } from "./types";
import { buildWorld } from "../demo/seed";

const w = buildWorld(new Date(Date.UTC(2026, 9, 6, 11))); // Tue Oct 6, 7:00 AM in the DC area
const tz = w.salon.timezone;
const knotless = w.styles.find((s) => s.name === "Knotless braids")!;
const opt = (label: string, style = knotless) => w.options.find((o) => o.style_id === style.id && o.label === label)!;
const [selam, meron] = w.stylists;

describe("price and time", () => {
  it("come from the style and the chosen options", () => {
    expect(quote(knotless, [opt("Small"), opt("Waist")])).toEqual({ minutes: 240 + 60 + 90, price: 250 + 60 + 80 });
    expect(quote(knotless, [opt("Large"), opt("Shoulder")])).toEqual({ minutes: 195, price: 220 });
  });
  it("need one size and one length when the style has them", () => {
    expect(optionsProblem(knotless, w.options, [opt("Small").id])).toBe("Choose a length.");
    expect(optionsProblem(knotless, w.options, [opt("Small").id, opt("Medium").id, opt("Waist").id])).toBe("Choose one size and one length.");
    expect(optionsProblem(knotless, w.options, [opt("Small").id, opt("Waist").id])).toBeNull();
    const cornrows = w.styles.find((s) => s.name === "Cornrows")!;
    expect(optionsProblem(cornrows, w.options, [])).toBeNull(); // extras are optional
    expect(optionsProblem(cornrows, w.options, [opt("Small").id])).toBe("Choose options from this style.");
  });
});

describe("free times", () => {
  const base = { salon: w.salon, stylists: w.stylists, hours: w.hours, minutes: 120 };
  const day = "2026-10-08"; // a Thursday: Selam and Meron work, Hiwot is off

  it("start on the 30-minute grid inside working hours, ending by closing time", () => {
    const slots = freeSlots({ ...base, busy: [], day, now: new Date(Date.UTC(2026, 9, 6, 11)) });
    expect(formatTime(slots[0].startsAt, tz)).toBe("9:00 AM");
    expect(formatTime(slots.at(-1)!.startsAt, tz)).toBe("5:00 PM"); // 5 + 2 h = 7 PM closing
    expect(slots.every((s) => new Date(s.startsAt).getUTCMinutes() % 30 === 0)).toBe(true);
    expect(slots[0].stylists).toEqual([selam.id, meron.id]);
  });

  it("leave out a stylist who is busy, and the time when everyone is", () => {
    const busy = [
      { stylist_id: selam.id, starts_at: at(day, "09:00", tz).toISOString(), ends_at: at(day, "12:00", tz).toISOString() },
      { stylist_id: meron.id, starts_at: at(day, "09:00", tz).toISOString(), ends_at: at(day, "10:00", tz).toISOString() },
    ];
    const slots = freeSlots({ ...base, busy, day, now: new Date(Date.UTC(2026, 9, 6, 11)) });
    const t = (s: (typeof slots)[number]) => formatTime(s.startsAt, tz);
    expect(slots.map(t)).not.toContain("9:00 AM");
    expect(slots.find((s) => t(s) === "10:00 AM")!.stylists).toEqual([meron.id]);
    expect(slots.find((s) => t(s) === "12:00 PM")!.stylists).toEqual([selam.id, meron.id]);
    // 10:30 for 2 hours overlaps Selam's 9 to 12, so only Meron.
    expect(slots.find((s) => t(s) === "10:30 AM")!.stylists).toEqual([meron.id]);
  });

  it("respect the salon's notice and booking window", () => {
    const now = at(day, "10:15", tz); // 2 hours' notice: the first time is 12:30
    expect(formatTime(freeSlots({ ...base, busy: [], day, now })[0].startsAt, tz)).toBe("12:30 PM");
    expect(freeSlots({ ...base, busy: [], day: "2027-01-30", now })).toEqual([]);
  });

  it("can be limited to one stylist, and are empty on their day off", () => {
    const slots = freeSlots({ ...base, busy: [], day, now: new Date(Date.UTC(2026, 9, 6, 11)), only: meron.id });
    expect(slots.every((s) => s.stylists.join() === meron.id)).toBe(true);
    expect(freeSlots({ ...base, busy: [], day: "2026-10-11", now: new Date(Date.UTC(2026, 9, 6, 11)), only: meron.id })).toEqual([]); // a Sunday
  });

  it("fit long styles only where the whole appointment fits", () => {
    const slots = freeSlots({ ...base, minutes: 390, busy: [], day, now: new Date(Date.UTC(2026, 9, 6, 11)) });
    expect(formatTime(slots.at(-1)!.startsAt, tz)).toBe("12:30 PM"); // 12:30 + 6 h 30 min = 7 PM
  });

  it("stay right on the day the clocks change", () => {
    const slots = freeSlots({ ...base, busy: [], day: "2026-11-02", now: new Date(Date.UTC(2026, 9, 30, 12)) });
    expect(formatTime(slots[0].startsAt, tz)).toBe("9:00 AM");
  });

  it("count open appointments and time off as busy, not cancelled ones", () => {
    const busy = busyFrom(w.appointments, w.timeOff);
    expect(busy.length).toBe(w.appointments.filter((a) => a.status === "pending" || a.status === "confirmed").length + w.timeOff.length);
  });

  it("hold the travel time before and after each home visit", () => {
    const a = w.appointments.find((x) => x.status === "confirmed")!;
    const [b] = busyFrom([{ ...a, busy_until: undefined }], [], 60);
    expect(Date.parse(a.starts_at) - Date.parse(b.starts_at)).toBe(3600000);
    expect(Date.parse(b.ends_at) - Date.parse(a.ends_at)).toBe(3600000);
  });

  it("the demo diary leaves every stylist time to travel", () => {
    const open = w.appointments.filter((a) => a.status === "pending" || a.status === "confirmed");
    for (const a of open) for (const b of open) {
      if (a === b || a.stylist_id !== b.stylist_id) continue;
      expect(Date.parse(a.busy_until!) <= Date.parse(b.starts_at) || Date.parse(b.busy_until!) <= Date.parse(a.starts_at)).toBe(true);
    }
  });

  it("offer two weeks of days, starting today", () => {
    const days = bookableDays(w.salon, new Date(Date.UTC(2026, 9, 6, 11)));
    expect(days.length).toBe(14);
    expect(days[0]).toBe("2026-10-06");
  });
});

describe("cancelling", () => {
  const now = new Date(Date.UTC(2026, 9, 6, 11));
  const appt = (status: Appointment["status"], hoursAhead: number) =>
    ({ ...w.appointments[0], status, starts_at: new Date(now.getTime() + hoursAhead * 3600000).toISOString() });
  it("a waiting request any time before it starts", () => {
    expect(cancelRule(appt("pending", 3), w.salon, now)).toBe("ok");
  });
  it("a confirmed one up to 24 hours before; after that, call the salon", () => {
    expect(cancelRule(appt("confirmed", 30), w.salon, now)).toBe("ok");
    expect(cancelRule(appt("confirmed", 10), w.salon, now)).toBe("call");
  });
  it("never a past or finished one", () => {
    expect(cancelRule(appt("pending", -1), w.salon, now)).toBe("no");
    expect(cancelRule(appt("completed", 30), w.salon, now)).toBe("no");
  });
});

describe("home visits", () => {
  const salon = { service_zips: ["200", "201", "202", "203", "204", "205", "206", "207", "208", "209"] };
  it("come to ZIP codes starting 200 to 209 only", () => {
    expect(inServiceArea("20001", salon)).toBe(true);
    expect(inServiceArea("20910", salon)).toBe(true);
    expect(inServiceArea("21201", salon)).toBe(false);
    expect(inServiceArea("22201", salon)).toBe(false);
    expect(inServiceArea("2000", salon)).toBe(false);
  });
  it("need a street, a city and a 5-digit ZIP code", () => {
    expect(addressProblem({ address: "12 Demo Street", city: "Washington, DC", zip: "20001" }, salon)).toBeNull();
    expect(addressProblem({ address: "", city: "Washington, DC", zip: "20001" }, salon)).toBe("address");
    expect(addressProblem({ address: "12 Demo Street", city: "Washington, DC", zip: "200" }, salon)).toBe("zip");
    expect(addressProblem({ address: "12 Demo Street", city: "Arlington, VA", zip: "22201" }, salon)).toBe("area");
  });
  it("describe the area in ranges", () => {
    expect(areaLabel(salon.service_zips)).toBe("200–209");
    expect(areaLabel(["220", "200", "201"])).toBe("200–201, 220");
  });
  it("link to the address on a map", () => {
    expect(mapsUrl({ visit_address: "12 Demo Street", visit_city: "Washington, DC", visit_zip: "20001" }))
      .toBe("https://www.google.com/maps/search/?api=1&query=12%20Demo%20Street%2C%20Washington%2C%20DC%2C%2020001");
  });
});
