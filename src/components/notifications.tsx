"use client";
// Notifications: what changed about your appointments (made by the database, so
// they can't be faked), plus a reminder for anything in the next 24 hours.
// Opening the page marks them as read.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { reminders } from "@/lib/domain/reminders";
import { formatSlot, formatTime, localDay } from "@/lib/domain/time";
import type { Appointment, Dataset, Notification } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { Empty, PageHeader } from "./ui";

type T = ReturnType<typeof useT>;

/** How many things are new: unread notifications plus reminders (customers). */
export function useNewCount(): number {
  const { data } = useApp();
  const [now] = useState(() => new Date());
  return data.notifications.filter((n) => !n.read_at).length + (data.me.role === "customer" ? reminders(data.appointments, data.me.id, now).length : 0);
}

export function Bell() {
  const t = useT();
  const n = useNewCount();
  return (
    <Link href="/app/notifications" className="relative grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label={t("notes.open", { n })} data-bell>
      <Icon name="bell" />
      {n > 0 && <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[0.7rem] font-semibold leading-5 text-white" data-bell-count>{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}

const when = (iso: string, data: Dataset, t: T, now: Date) => {
  const tz = data.salon.timezone, d = localDay(new Date(iso), tz), today = localDay(now, tz);
  const tomorrow = localDay(new Date(now.getTime() + 86400000), tz);
  return d === today ? t("notes.today", { time: formatTime(iso, tz) }) : d === tomorrow ? t("notes.tomorrow", { time: formatTime(iso, tz) }) : formatSlot(iso, iso, tz).split(" – ")[0];
};

/** The words for a notification, in the reader's language. */
export function noteText(n: Notification, data: Dataset, t: T, now: Date) {
  const v = { customer: n.data.customer ?? "", style: n.data.style ?? "", stylist: n.data.stylist ?? "", when: n.data.starts_at ? when(n.data.starts_at, data, t, now) : "" };
  return { title: t(`notes.${n.kind}`, v), body: t(`notes.${n.kind}Body`, v) };
}

const ago = (iso: string, t: T, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  return m < 1 ? t("notes.ago.now") : m < 60 ? t("notes.ago.min", { n: m }) : m < 1440 ? t("notes.ago.hour", { n: Math.round(m / 60) }) : t("notes.ago.day", { n: Math.round(m / 1440) });
};

export function NotificationsPage() {
  const t = useT();
  const { data, store, reload } = useApp();
  const [now] = useState(() => new Date());
  // What was unread when the page opened stays marked "New" while you read.
  const [fresh] = useState(() => new Set(data.notifications.filter((n) => !n.read_at).map((n) => n.id)));
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !fresh.size) return;
    marked.current = true;
    store.markRead([...fresh]).then(reload, () => {});
  }, [fresh, store, reload]);

  const soon: Appointment[] = data.me.role === "customer" ? reminders(data.appointments, data.me.id, now) : [];
  const stylist = (id: string) => data.stylists.find((s) => s.id === id)?.name ?? "";
  return (
    <>
      <PageHeader title={t("notes.title")} />
      {soon.length > 0 && (
        <section className="mb-5" aria-labelledby="soon">
          <h2 id="soon" className="muted mb-2 text-sm">{t("notes.comingUp")}</h2>
          <ul className="space-y-2">
            {soon.map((a) => (
              <li key={a.id} className="card flex gap-3 border-accent p-3.5" data-reminder>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Icon name="clock" /></span>
                <div className="min-w-0">
                  <p className="font-semibold">{t("notes.reminder", { style: a.style_name, when: when(a.starts_at, data, t, now) })}</p>
                  <p className="muted text-sm">{t("notes.reminderBody", { stylist: stylist(a.stylist_id), address: [a.visit_address, a.visit_city].filter(Boolean).join(", ") || t("notes.yourHome") })}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.notifications.length ? (
        <ul className="space-y-2" data-notes>
          {data.notifications.map((n) => {
            const x = noteText(n, data, t, now);
            const isNew = fresh.has(n.id);
            return (
              <li key={n.id}>
                <Link href="/app" className={`card flex gap-3 p-3.5 hover:border-brand ${isNew ? "border-brand/50 bg-brand-soft/40" : ""}`} data-note={n.kind}>
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${isNew ? "bg-brand" : "bg-transparent"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{x.title}{isNew && <span className="sr-only"> ({t("notes.new")})</span>}</span>
                    <span className="muted block text-sm">{x.body}</span>
                    <span className="muted block text-xs">{ago(n.created_at, t, now)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : !soon.length && <Empty icon="bell" text={t("notes.none")} />}
    </>
  );
}
