import { beforeEach, describe, expect, it } from "vitest";
import { DemoStore, loadWorld, resetDemo } from "./demo-store";
import { at, formatTime } from "../domain/time";

// localStorage for the tests (the demo keeps the salon there).
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const NOW = new Date(Date.UTC(2026, 9, 6, 11)); // Tue Oct 6, 7:00 AM in the DC area
const clock = () => NOW;
const w0 = () => loadWorld(NOW);
const customer = () => w0().accounts[0].profile_id;
const admin = () => w0().accounts[1].profile_id;
const style = (name: string) => w0().styles.find((s) => s.name === name)!;
const option = (styleName: string, label: string) => w0().options.find((o) => o.style_id === style(styleName).id && o.label === label)!.id;
const tz = "America/New_York";

describe("booking in the demo (the database's rules)", () => {
  beforeEach(() => { mem.clear(); resetDemo(); });

  it("books a request with the price and time worked out, which the salon then sees", async () => {
    const store = new DemoStore(customer(), clock);
    const a = await store.book({ styleId: style("Knotless braids").id, optionIds: [option("Knotless braids", "Large"), option("Knotless braids", "Shoulder")],
      stylistId: null, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "  Black hair please  " });
    expect(a.status).toBe("pending");
    expect(a.price).toBe(220);
    expect((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000).toBe(195);
    expect(a.note).toBe("Black hair please");
    const salon = await new DemoStore(admin(), clock).load();
    expect(salon.appointments.some((x) => x.id === a.id)).toBe(true);
  });

  it("refuses a taken time, a time off the grid, too little notice and a missing size", async () => {
    const store = new DemoStore(customer(), clock);
    const cornrows = style("Cornrows").id;
    const first = await store.book({ styleId: cornrows, optionIds: [], stylistId: w0().stylists[0].id, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "" });
    const other = new DemoStore(w0().profiles[3].id, clock); // Hana now has 3 upcoming, so another customer tries
    await expect(other.book({ styleId: cornrows, optionIds: [], stylistId: first.stylist_id, startsAt: at("2026-10-16", "09:30", tz).toISOString(), note: "" }))
      .rejects.toThrow("no longer free");
    await expect(other.book({ styleId: cornrows, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "10:10", tz).toISOString(), note: "" }))
      .rejects.toThrow("offered times");
    await expect(other.book({ styleId: cornrows, optionIds: [], stylistId: null, startsAt: at("2026-10-06", "08:00", tz).toISOString(), note: "" }))
      .rejects.toThrow("hours ahead");
    await expect(other.book({ styleId: style("Box braids").id, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "13:00", tz).toISOString(), note: "" }))
      .rejects.toThrow("Choose a size.");
  });

  it("\"any stylist\" picks one who is free", async () => {
    const store = new DemoStore(customer(), clock);
    const when = at("2026-10-16", "09:00", tz).toISOString();
    const a = await store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: when, note: "" });
    const b = await new DemoStore(w0().profiles[3].id, clock).book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: when, note: "" });
    expect(a.stylist_id).not.toBe(b.stylist_id);
  });

  it("allows at most 3 upcoming bookings", async () => {
    const store = new DemoStore(customer(), clock); // Hana already has 2 upcoming
    await store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "" });
    await expect(store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: at("2026-10-17", "09:00", tz).toISOString(), note: "" }))
      .rejects.toThrow("3 upcoming");
  });

  it("cancels your own request, which frees the time; not someone else's", async () => {
    const store = new DemoStore(customer(), clock);
    const a = await store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: w0().stylists[0].id, startsAt: at("2026-10-16", "11:00", tz).toISOString(), note: "" });
    await expect(new DemoStore(w0().profiles[3].id, clock).cancel(a.id)).rejects.toThrow("not found");
    await store.cancel(a.id);
    expect(w0().appointments.find((x) => x.id === a.id)!.cancelled_by).toBe("customer");
    const busy = await store.busyTimes(at("2026-10-16", "00:00", tz).toISOString(), at("2026-10-17", "00:00", tz).toISOString());
    expect(busy.some((b) => b.stylist_id === a.stylist_id && formatTime(b.starts_at, tz) === "11:00 AM")).toBe(false);
  });

  it("a confirmed appointment within 24 hours needs a call", async () => {
    const w = w0();
    const tomorrow = w.appointments.find((a) => a.customer_id === customer() && a.status === "confirmed")!;
    tomorrow.starts_at = new Date(NOW.getTime() + 10 * 3600000).toISOString();
    tomorrow.ends_at = new Date(NOW.getTime() + 14 * 3600000).toISOString();
    localStorage.setItem("awaa_demo_world_v1", JSON.stringify(w));
    await expect(new DemoStore(customer(), clock).cancel(tomorrow.id)).rejects.toThrow("call the salon");
  });

  it("busy times carry no one's name or details", async () => {
    const busy = await new DemoStore(customer(), clock).busyTimes(NOW.toISOString(), new Date(NOW.getTime() + 14 * 86400000).toISOString());
    expect(busy.length).toBeGreaterThan(0);
    expect(busy.every((b) => Object.keys(b).sort().join() === "ends_at,starts_at,stylist_id")).toBe(true);
  });
});
