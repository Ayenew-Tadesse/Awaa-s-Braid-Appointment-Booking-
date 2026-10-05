"use client";
// The salon's numbers: bookings per week, most booked styles, no-show and
// cancellation rates, what was earned and what's coming.
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { useApp } from "@/lib/data/app-context";
import { salonReport } from "@/lib/domain/salon";
import { at, formatMoney, getDateLocale } from "@/lib/domain/time";
import { useT } from "@/lib/i18n";

export default function Reports() {
  const t = useT();
  const { data } = useApp();
  const [now] = useState(() => new Date());
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;
  const tz = data.salon.timezone;
  const r = salonReport(data.appointments, now, tz);
  const pct = (v: number | null) => (v == null ? t("salon.none") : `${Math.round(v * 100)}%`);
  const max = Math.max(1, ...r.weeks.map((w) => w.booked));
  const label = (day: string) => new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, month: "short", day: "numeric" }).format(at(day, "12:00", tz));
  return (
    <>
      <Link href="/app/salon" className="muted mb-2 inline-flex items-center gap-1 text-sm"><Icon name="chevron" size={16} className="rotate-180" />{t("salon.title")}</Link>
      <PageHeader title={t("salon.reportTitle")} />
      <div className="grid grid-cols-2 gap-2.5" data-report-stats>
        <Stat icon="money" label={t("salon.earned")} value={formatMoney(r.earned30, data.salon.currency)} />
        <Stat icon="calendar" label={t("salon.expected")} value={formatMoney(r.expected7, data.salon.currency)} />
        <Stat icon="users" label={t("salon.noShow")} value={pct(r.noShowRate)} />
        <Stat icon="x" label={t("salon.cancelRate")} value={pct(r.cancelRate)} />
      </div>
      <Card className="mt-4" title={t("salon.weeks")}>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label={r.weeks.map((w) => `${label(w.start)}: ${w.booked}`).join(", ")} data-week-bars>
          {r.weeks.map((w, i) => (
            <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold tabular-nums">{w.booked}</span>
              <div className={`w-full rounded-t-md ${i === r.weeks.length - 1 ? "bg-brand" : "bg-brand/45"}`} style={{ height: `${Math.max(3, (w.booked / max) * 100)}%` }} />
              <span className="muted whitespace-nowrap text-[0.65rem]">{label(w.start)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-4" title={t("salon.popular")}>
        {r.popular.length ? (
          <ol className="space-y-2" data-popular>
            {r.popular.map((p) => (
              <li key={p.style} className="text-sm">
                <div className="flex justify-between"><span>{p.style}</span><span className="font-semibold tabular-nums">{p.count}</span></div>
                <div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(p.count / r.popular[0].count) * 100}%` }} /></div>
              </li>
            ))}
          </ol>
        ) : <p className="muted text-sm">{t("salon.none")}</p>}
      </Card>
    </>
  );
}
