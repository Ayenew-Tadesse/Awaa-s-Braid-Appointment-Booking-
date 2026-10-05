import { describe, expect, it } from "vitest";
import { reminders } from "./reminders";
import { buildWorld } from "../demo/seed";

const now = new Date(Date.UTC(2026, 9, 6, 11));
const w = buildWorld(now);
const me = w.accounts[0].profile_id;
const at = (h: number, status: "pending" | "confirmed" | "cancelled" = "confirmed") =>
  ({ ...w.appointments[0], id: `x${h}${status}`, customer_id: me, status, starts_at: new Date(now.getTime() + h * 3600000).toISOString() });

describe("day-before reminders", () => {
  it("cover your open appointments in the next 24 hours, soonest first", () => {
    expect(reminders([at(30), at(20), at(2, "pending"), at(5, "cancelled"), at(-1)], me, now).map((a) => a.id)).toEqual(["x2pending", "x20confirmed"]);
  });
  it("never someone else's", () => {
    expect(reminders([{ ...at(3), customer_id: "someone" }], me, now)).toEqual([]);
  });
});
