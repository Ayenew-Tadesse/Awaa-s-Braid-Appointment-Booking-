"use client";
// A stylist's own day: today's jobs first, then what's coming up and what was
// done lately. Each job says who, where (with a map link), what and what to
// collect; once a confirmed job has started, the stylist marks it done or
// missed (mark_job). Everything else stays with the salon.
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { errorText } from "@/lib/data/store";
import { mapsUrl } from "@/lib/domain/booking";
import { formatDay, formatDuration, formatMoney, formatTime, localDay } from "@/lib/domain/time";
import type { Appointment } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { useToast } from "./toast";
import { Empty, PageHeader, StatusBadge } from "./ui";

export function StylistHome() {
  const t = useT();
  const { data } = useApp();
  const [now] = useState(() => new Date());
  const tz = data.salon.timezone;
  const me = data.stylists.find((s) => s.profile_id === data.me.id);
  const jobs = data.appointments.filter((a) => me && a.stylist_id === me.id && a.status !== "cancelled");
  const today = localDay(now, tz);
  const day = (a: Appointment) => localDay(new Date(a.starts_at), tz);
  const byTime = (a: Appointment, b: Appointment) => a.starts_at.localeCompare(b.starts_at);
  const todays = jobs.filter((a) => day(a) === today).sort(byTime);
  const later = jobs.filter((a) => day(a) > today).sort(byTime);
  const recent = jobs.filter((a) => day(a) < today && Date.parse(a.starts_at) > now.getTime() - 7 * 86400000).sort((a, b) => byTime(b, a));
  const first = data.me.full_name.split(/\s+/)[0] || data.me.full_name;

  if (!me) return <Empty text={t("jobs.notLinked")} />;
  return (
    <>
      <PageHeader title={t("home.hello", { name: first })} subtitle={formatDay(now.toISOString(), tz, { weekday: "long" })} />
      <div className="space-y-6" data-jobs>
        <section aria-labelledby="today">
          <h2 id="today" className="mb-2 font-semibold">{t("jobs.today")}</h2>
          {todays.length ? <ul className="space-y-2.5">{todays.map((a) => <Job key={a.id} a={a} now={now} />)}</ul> : <Empty icon="calendar" text={t("jobs.none")} />}
        </section>
        <section aria-labelledby="later">
          <h2 id="later" className="mb-2 font-semibold">{t("jobs.upcoming")}</h2>
          {later.length ? <ul className="space-y-2.5">{later.map((a) => <Job key={a.id} a={a} now={now} showDay />)}</ul> : <p className="muted text-sm">{t("jobs.noneUpcoming")}</p>}
        </section>
        {recent.length > 0 && (
          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-2 font-semibold">{t("jobs.recent")}</h2>
            <ul className="space-y-2.5">{recent.map((a) => <Job key={a.id} a={a} now={now} showDay />)}</ul>
          </section>
        )}
      </div>
    </>
  );
}

function Job({ a, now, showDay }: { a: Appointment; now: Date; showDay?: boolean }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const [busy, setBusy] = useState(false);
  const tz = data.salon.timezone;
  const c = data.people.find((p) => p.id === a.customer_id);
  const phone = c?.phone?.replace(/[^\d+]/g, "");
  const canMark = a.status === "confirmed" && Date.parse(a.starts_at) <= now.getTime();
  const mark = async (status: "completed" | "no_show") => {
    setBusy(true);
    try { await store.markJob(a.id, status); await reload(); toast(t(status === "completed" ? "jobs.doneToast" : "jobs.missedToast")); }
    catch (e) { toast(errorText(e), "error"); }
    finally { setBusy(false); }
  };
  return (
    <li className="card p-4" data-job={a.style_name}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showDay && <p className="muted text-xs">{formatDay(a.starts_at, tz, { weekday: "long" })}</p>}
          <p className="font-semibold tabular-nums">{formatTime(a.starts_at, tz)} – {formatTime(a.ends_at, tz)}</p>
          <p className="muted text-xs">{formatDuration((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000)}</p>
        </div>
        <StatusBadge status={a.status} label={t(`status.${a.status}`)} />
      </div>
      <p className="mt-1">{a.style_name}{a.options.length ? <span className="muted"> · {a.options.map((o) => o.label).join(" · ")}</span> : null}</p>
      <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="muted">{t("sheet.customer")}</dt><dd data-job-customer>{c?.full_name}</dd>
        {a.visit_address && <><dt className="muted">{t("sheet.where")}</dt><dd data-job-place>{a.visit_address}<br />{[a.visit_city, a.visit_zip].filter(Boolean).join(" ")}</dd></>}
        {a.note && <><dt className="muted">{t("sheet.note")}</dt><dd className="whitespace-pre-wrap">{a.note}</dd></>}
        <dt className="muted">{t("sheet.price")}</dt><dd className="font-semibold">{t("jobs.collect", { price: formatMoney(a.price, data.salon.currency) })}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {phone && <a href={`tel:${phone}`} className="btn btn-ghost btn-sm"><Icon name="phone" size={16} />{t("sheet.call", { name: c!.full_name.split(" ")[0] })}</a>}
        {a.visit_address && <a href={mapsUrl(a)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" data-map><Icon name="pin" size={16} />{t("sheet.openMap")}</a>}
      </div>
      {canMark && (
        <div className="mt-3 grid grid-cols-2 gap-2" data-mark-actions>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => mark("completed")} data-mark="completed">{t("jobs.done")}</button>
          <button type="button" className="btn btn-ghost text-bad" disabled={busy} onClick={() => mark("no_show")} data-mark="no_show">{t("jobs.missed")}</button>
        </div>
      )}
    </li>
  );
}
