"use client";
// A stylist's own working week and time off, to read (the salon sets them).
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { clockLabel, formatDay, formatTime, localDay } from "@/lib/domain/time";
import { useT } from "@/lib/i18n";
import { DAYS } from "./manage-team";
import { Card, Empty, PageHeader } from "./ui";

export function StylistWeek() {
  const t = useT();
  const { data } = useApp();
  const [now] = useState(() => Date.now());
  const tz = data.salon.timezone;
  const me = data.stylists.find((s) => s.profile_id === data.me.id);
  if (data.me.role !== "stylist" || !me) return <Empty text={t("jobs.notLinked")} />;
  const off = data.timeOff.filter((x) => x.stylist_id === me.id && Date.parse(x.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <PageHeader title={t("week.title")} subtitle={t("week.lead")} />
      <div className="space-y-4">
        <Card title={t("salon.week")}>
          <ul className="space-y-1 text-sm" data-my-week>
            {DAYS.map((d) => {
              const blocks = data.hours.filter((h) => h.stylist_id === me.id && h.weekday === d).sort((a, b) => a.starts.localeCompare(b.starts));
              return (
                <li key={d} className="flex justify-between gap-3">
                  <span>{t(`salon.days.${d}`)}</span>
                  <span className={blocks.length ? "tabular-nums" : "muted"}>{blocks.length ? blocks.map((b) => `${clockLabel(b.starts)} – ${clockLabel(b.ends)}`).join(", ") : t("salon.off")}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title={t("salon.timeOff")}>
          {off.length ? (
            <ul className="divide-y divide-line text-sm" data-my-time-off>
              {off.map((x) => (
                <li key={x.id} className="py-2">{formatDay(x.starts_at, tz)} {formatTime(x.starts_at, tz)} – {localDay(new Date(x.ends_at), tz) !== localDay(new Date(x.starts_at), tz) ? `${formatDay(x.ends_at, tz)} ` : ""}{formatTime(x.ends_at, tz)}{x.reason ? <span className="muted"> · {x.reason}</span> : null}</li>
              ))}
            </ul>
          ) : <p className="muted text-sm">{t("salon.noTimeOff")}</p>}
        </Card>
      </div>
    </>
  );
}
