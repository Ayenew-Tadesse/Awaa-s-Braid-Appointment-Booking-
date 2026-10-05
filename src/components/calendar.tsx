"use client";
// The salon's calendar. Day: each stylist's hours, time off and appointments
// (tap one to act on it). Week: Monday to Sunday at a glance; tap a day to open it.
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { addDays, at, formatDay, formatTime, localDay, weekdayOf, getDateLocale } from "@/lib/domain/time";
import type { Appointment } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { AppointmentCard } from "./appointment-card";
import { AppointmentSheet } from "./appointment-sheet";
import { Icon } from "./icons";
import { Empty } from "./ui";

export function Calendar() {
  const t = useT();
  const { data } = useApp();
  const tz = data.salon.timezone;
  const [today] = useState(() => localDay(new Date(), tz));
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState(today);
  const [open, setOpen] = useState<Appointment | null>(null);
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;

  const dayOf = (iso: string) => localDay(new Date(iso), tz);
  const noon = (d: string) => at(d, "12:00", tz).toISOString();
  const monday = addDays(day, -((weekdayOf(day) + 6) % 7));
  const stylists = data.stylists.filter((s) => s.active).sort((a, b) => a.sort - b.sort);
  const shown = (d: string) => data.appointments.filter((a) => a.status !== "cancelled" && dayOf(a.starts_at) === d).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const step = (n: number) => setDay(addDays(day, view === "day" ? n : 7 * n));
  const hm = (d: string, hhmm: string) => formatTime(at(d, hhmm, tz).toISOString(), tz);

  return (
    <div data-calendar data-view={view}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">{t("calendar.title")}</h1>
        <div className="flex rounded-full bg-surface-2 p-1" role="tablist">
          {(["day", "week"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} data-view-tab={v}
              className={`min-h-9 rounded-full px-4 text-sm ${view === v ? "bg-surface font-semibold text-brand shadow-sm" : "text-muted"}`}>{t(`calendar.${v}`)}</button>
          ))}
        </div>
      </div>
      <div className="card mb-4 flex items-center gap-2 p-2">
        <button type="button" onClick={() => step(-1)} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label={t("calendar.prev")} data-prev><Icon name="chevron" className="rotate-180" /></button>
        <p className="min-w-0 flex-1 text-center font-semibold" data-cal-date>
          {view === "day" ? formatDay(noon(day), tz, { weekday: "long" }) : t("calendar.weekOf", { date: formatDay(noon(monday), tz) })}
        </p>
        {day !== today && <button type="button" onClick={() => setDay(today)} className="btn btn-ghost btn-sm" data-today>{t("calendar.today")}</button>}
        <button type="button" onClick={() => step(1)} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label={t("calendar.next")} data-next-day><Icon name="chevron" /></button>
      </div>

      {view === "day" ? (
        <div className="space-y-4">
          {stylists.map((s) => {
            const blocks = data.hours.filter((h) => h.stylist_id === s.id && h.weekday === weekdayOf(day)).sort((a, b) => a.starts.localeCompare(b.starts));
            const off = data.timeOff.filter((x) => x.stylist_id === s.id && dayOf(x.starts_at) <= day && dayOf(x.ends_at) >= day);
            const list = shown(day).filter((a) => a.stylist_id === s.id);
            return (
              <section key={s.id} className="card p-3.5" data-cal-stylist={s.name}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  <p className="muted text-xs">{blocks.length ? blocks.map((b) => `${hm(day, b.starts)} – ${hm(day, b.ends)}`).join(", ") : t("calendar.off")}</p>
                </div>
                {off.map((x) => <p key={x.id} className="mb-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" data-time-off>{t("calendar.timeOff")}: {formatTime(x.starts_at, tz)} – {formatTime(x.ends_at, tz)}{x.reason ? ` · ${x.reason}` : ""}</p>)}
                <div className="space-y-2">
                  {list.length ? list.map((a) => <AppointmentCard key={a.id} a={a} data={data} showCustomer onOpen={setOpen} />)
                    : blocks.length && !off.length ? <p className="muted text-sm">{t("calendar.free")}</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2" data-week>
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => {
            const list = shown(d);
            return (
              <li key={d}>
                <button type="button" onClick={() => { setDay(d); setView("day"); }} data-week-day={d}
                  className={`card flex w-full items-center gap-3 p-3 text-left hover:border-brand ${d === today ? "border-brand" : ""}`}>
                  <span className="w-16 shrink-0">
                    <span className="muted block text-xs">{new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, weekday: "short" }).format(new Date(noon(d)))}</span>
                    <span className="block font-semibold">{new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, month: "short", day: "numeric" }).format(new Date(noon(d)))}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {stylists.map((s) => {
                      const n = list.filter((a) => a.stylist_id === s.id).length;
                      const works = data.hours.some((h) => h.stylist_id === s.id && h.weekday === weekdayOf(d));
                      return <span key={s.id} className={`badge ${!works ? "badge-cancelled line-through" : n ? "bg-brand-soft text-brand" : "badge-cancelled"}`}>{s.name} {works ? n : ""}</span>;
                    })}
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-semibold tabular-nums">{list.length}</span>
                    {list.some((a) => a.status === "pending") && <span className="block text-xs text-warn">{t("calendar.toConfirm", { n: list.filter((a) => a.status === "pending").length })}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <AppointmentSheet appointment={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
