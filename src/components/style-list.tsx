"use client";
// The styles with their price, time and options: on the home page, and in the app.
import type { Style, StyleOption } from "@/lib/domain/types";
import { formatDuration, formatMoney } from "@/lib/domain/time";
import { useT } from "@/lib/i18n";
import { StyleArt } from "./style-art";

/** The lowest price and the shortest time a style can have with its options. */
export function styleRange(style: Style, options: StyleOption[]) {
  const mine = options.filter((o) => o.style_id === style.id);
  const kinds = [...new Set(mine.map((o) => o.kind))];
  // The cheapest pick of each kind (sizes and lengths are one each; extras are optional).
  const minOf = (f: (o: StyleOption) => number) => kinds.reduce((sum, k) => sum + Math.min(...mine.filter((o) => o.kind === k).map(f), ...(k === "extra" ? [0] : [])), 0);
  return { price: Math.max(0, style.price + minOf((o) => o.extra_price)), minutes: Math.max(15, style.duration_minutes + minOf((o) => o.extra_minutes)) };
}

export function StyleList({ styles, options, currency, limit }: { styles: Style[]; options: StyleOption[]; currency: string; limit?: number }) {
  const t = useT();
  const shown = [...styles].sort((a, b) => a.sort - b.sort).slice(0, limit);
  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-style-list>
      {shown.map((s) => {
        const r = styleRange(s, options);
        const mine = options.filter((o) => o.style_id === s.id);
        const group = (k: StyleOption["kind"]) => mine.filter((o) => o.kind === k).map((o) => o.label).join(", ");
        return (
          <li key={s.id} className="card flex overflow-hidden" data-style={s.name}>
            <StyleArt category={s.category} className="h-auto w-24 shrink-0 sm:w-28" />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">{s.name}</h3>
                {!s.active && <span className="badge badge-cancelled">{t("styles.retired")}</span>}
              </div>
              <p className="mt-0.5 text-sm font-semibold text-brand">{t("styles.from", { price: formatMoney(r.price, currency) })}</p>
              <p className="muted text-xs">{t("styles.takes", { time: formatDuration(r.minutes) })}</p>
              {s.description && <p className="muted mt-1.5 line-clamp-2 text-sm">{s.description}</p>}
              {(group("size") || group("length") || group("extra")) && (
                <p className="muted mt-1.5 text-xs">
                  {[group("size") && `${t("styles.sizes")}: ${group("size")}`, group("length") && `${t("styles.lengths")}: ${group("length")}`, group("extra") && `${t("styles.extras")}: ${group("extra")}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
