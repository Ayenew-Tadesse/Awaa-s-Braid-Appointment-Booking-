import { describe, expect, it } from "vitest";
import { en } from "./en";
import { am } from "./am";
import { translate } from "./index";

// Every English text has an Amharic one, with the same {placeholders}.
const flat = (o: unknown, at = ""): [string, string][] => typeof o === "string" ? [[at, o]]
  : Object.entries(o as object).flatMap(([k, v]) => flat(v, at ? `${at}.${k}` : k));
const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();

describe("Amharic", () => {
  const amText = new Map(flat(am));
  it("has every key English has", () => {
    expect(flat(en).map(([k]) => k).filter((k) => !amText.has(k))).toEqual([]);
  });
  it("keeps the same {placeholders}", () => {
    expect(flat(en).filter(([k, v]) => holes(v) !== holes(amText.get(k) ?? "")).map(([k]) => k)).toEqual([]);
  });
  it("is really translated (Ethiopic script), apart from the brand name", () => {
    // English words (outside {placeholders}) with no Ethiopic beside them; symbols like "+ $" are fine.
    const untranslated = flat(am).filter(([k, v]) => k !== "app.name" && /[A-Za-z]{2,}/.test(v.replace(/\{\w+\}|AM|PM/g, "")) && !/[\u1200-\u137F]/.test(v)).map(([k]) => k);
    expect(untranslated).toEqual([]);
  });
  it("fills placeholders and falls back to English for unknown keys", () => {
    expect(translate("am", "home.hello", { name: "Hana" })).toBe("ሰላም፣ Hana");
    expect(translate("am", "salon.days.1")).toBe("ሰኞ");
    expect(translate("am", "no.such.key")).toBe("no.such.key");
  });
});
