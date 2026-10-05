import { describe, expect, it } from "vitest";
import { siteVerdict } from "./site";

describe("who may use which website", () => {
  it("the demo lets every demo account in", () => {
    for (const role of ["customer", "stylist", "admin"] as const) expect(siteVerdict("demo", { role })).toBe("ok");
  });
  it("the customer website is for customers; staff are sent to the staff website", () => {
    expect(siteVerdict("customer", { role: "customer" })).toBe("ok");
    expect(siteVerdict("customer", { role: "customer", wants_stylist: true })).toBe("ok");
    expect(siteVerdict("customer", { role: "admin" })).toBe("use-staff-site");
    expect(siteVerdict("customer", { role: "stylist" })).toBe("use-staff-site");
  });
  it("the staff website is for the salon and stylists; someone who asked to join waits", () => {
    expect(siteVerdict("staff", { role: "admin" })).toBe("ok");
    expect(siteVerdict("staff", { role: "stylist" })).toBe("ok");
    expect(siteVerdict("staff", { role: "customer", wants_stylist: true })).toBe("waiting");
    expect(siteVerdict("staff", { role: "customer" })).toBe("staff-only");
  });
});
