"use client";
// For keyboard and screen-reader users: jump past the top bar to the page itself.
import { useT } from "@/lib/i18n";

export function SkipLink() {
  const t = useT();
  return <a href="#main" className="sr-only z-[100] rounded-xl bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-3 focus:top-3">{t("skip")}</a>;
}
