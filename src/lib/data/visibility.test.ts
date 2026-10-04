import { describe, expect, it } from "vitest";
import { buildWorld } from "../demo/seed";
import { visibleTo } from "./visibility";

const w = buildWorld(new Date(Date.UTC(2026, 9, 6, 6)));
const customer = w.accounts[0].profile_id;
const admin = w.accounts[1].profile_id;

describe("who sees what in the demo (same rules as the database)", () => {
  it("a customer sees only their own appointments and profile", () => {
    const d = visibleTo(w, customer);
    expect(d.appointments.length).toBeGreaterThan(0);
    expect(d.appointments.every((a) => a.customer_id === customer)).toBe(true);
    expect(d.people.map((p) => p.id)).toEqual([customer]);
  });

  it("a customer never gets other customers' names or phone numbers", () => {
    const text = JSON.stringify(visibleTo(w, customer));
    for (const p of w.profiles.filter((x) => x.id !== customer)) {
      expect(text).not.toContain(p.full_name);
      if (p.phone) expect(text).not.toContain(p.phone);
    }
  });

  it("a customer sees no time off and no retired styles", () => {
    const world = structuredClone(w);
    world.styles[0].active = false;
    const d = visibleTo(world, customer);
    expect(d.timeOff).toEqual([]);
    expect(d.styles.some((s) => s.id === world.styles[0].id)).toBe(false);
    expect(d.options.some((o) => o.style_id === world.styles[0].id)).toBe(false);
  });

  it("the salon sees everything", () => {
    const d = visibleTo(w, admin);
    expect(d.appointments.length).toBe(w.appointments.length);
    expect(d.people.length).toBe(w.profiles.length);
    expect(d.timeOff.length).toBe(w.timeOff.length);
  });

  it("changing what was handed out doesn't change the salon's data", () => {
    const d = visibleTo(w, admin);
    d.appointments[0].status = "cancelled";
    expect(w.appointments[0].status).not.toBe("cancelled");
  });

  it("an account that no longer exists is refused", () => {
    expect(() => visibleTo(w, "nobody")).toThrow(/no longer exists/);
  });
});
