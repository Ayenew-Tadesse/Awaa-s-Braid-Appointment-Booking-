"use client";
// Interface language: English now; Amharic is added as another dictionary.
// t("nav.home"), t("home.hello", { name }) with English as the fallback for missing keys.
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { en } from "./en";

export const LOCALES = [
  { code: "en", label: "English", dir: "ltr" },
] as const;
export type Locale = (typeof LOCALES)[number]["code"];
const DICTS: Record<Locale, unknown> = { en };
const KEY = "awaa_locale";

function lookup(dict: unknown, key: string): string | undefined {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), dict);
  return typeof v === "string" ? v : undefined;
}
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const s = lookup(DICTS[locale], key) ?? lookup(en, key) ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

let memory: Locale | null = null; // when storage is blocked
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
function readLocale(): Locale {
  try { const v = localStorage.getItem(KEY); if (LOCALES.some((l) => l.code === v)) return v as Locale; } catch { /* blocked */ }
  return memory ?? "en";
}

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const I18n = createContext<Ctx>({ locale: "en", setLocale: () => {}, t: (k, v) => translate("en", k, v) });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The chosen language lives in localStorage (English on the server and first paint).
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as Locale);
  useEffect(() => {
    const l = LOCALES.find((x) => x.code === locale)!;
    document.documentElement.lang = locale;
    document.documentElement.dir = l.dir;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    memory = l;
    try { localStorage.setItem(KEY, l); } catch { /* this visit only */ }
    listeners.forEach((f) => f());
  }, []);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
export const useT = () => useContext(I18n).t;
