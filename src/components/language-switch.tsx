"use client";
// English | አማርኛ, remembered on this device.
import { LOCALES, useI18n } from "@/lib/i18n";

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex gap-1" role="group" aria-label="Language / ቋንቋ" data-language>
      {LOCALES.map((l) => (
        <button key={l.code} type="button" lang={l.code} onClick={() => setLocale(l.code)} aria-pressed={locale === l.code}
          className={`min-h-9 rounded-full px-3 text-sm ${locale === l.code ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-surface-2"}`}>{l.label}</button>
      ))}
    </div>
  );
}
