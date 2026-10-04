"use client";
// A customer's home: their next appointment, then upcoming and past ones.
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { formatDuration, formatMoney, formatSlot } from "@/lib/domain/time";
import { isOpen } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { AppointmentCard } from "./appointment-card";
import { Icon } from "./icons";
import { Empty, StatusBadge } from "./ui";

export function CustomerHome() {
  const t = useT();
  const { data } = useApp();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [now] = useState(() => Date.now()); // when the screen opened
  const mine = data.appointments.filter((a) => a.customer_id === data.me.id);
  const upcoming = mine.filter((a) => isOpen(a) && Date.parse(a.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = mine.filter((a) => !upcoming.includes(a)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const next = upcoming[0];
  const first = data.me.full_name.split(/\s+/)[0] || data.me.full_name;
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("home.hello", { name: first })}</h1>

      <section aria-labelledby="next" className="rounded-3xl bg-brand p-5 text-on-brand" data-next>
        <h2 id="next" className="text-sm opacity-85">{t("home.next")}</h2>
        {next ? (
          <>
            <p className="mt-1 text-xl font-semibold">{next.style_name}</p>
            <p className="mt-0.5 opacity-90">{formatSlot(next.starts_at, next.ends_at, data.salon.timezone)}</p>
            <p className="text-sm opacity-85">
              {t("home.with", { name: data.stylists.find((s) => s.id === next.stylist_id)?.name ?? "" })} · {formatDuration((Date.parse(next.ends_at) - Date.parse(next.starts_at)) / 60000)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface px-1 py-0.5"><StatusBadge status={next.status} label={t(`status.${next.status}`)} /></span>
              <span className="text-sm opacity-90">{t("home.pay", { price: formatMoney(next.price, data.salon.currency) })}</span>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-xl font-semibold">{t("home.none")}</p>
            <p className="mt-0.5 text-sm opacity-90">{t("home.noneHint")}</p>
            <Link href="/app/styles" className="btn mt-4 bg-surface text-brand">{t("home.browse")}<Icon name="arrow" size={18} /></Link>
          </>
        )}
      </section>

      <section>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label={t("home.next")}>
          {(["upcoming", "past"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-tab={k}
              className={`min-h-10 flex-1 rounded-full text-sm ${tab === k ? "bg-surface font-semibold text-brand shadow-sm" : "text-muted"}`}>
              {t(`home.${k}`)} ({k === "upcoming" ? upcoming.length : past.length})
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2.5" role="tabpanel">
          {list.length ? list.map((a) => <AppointmentCard key={a.id} a={a} data={data} />)
            : <Empty text={tab === "upcoming" ? t("home.none") : t("home.noPast")} />}
        </div>
      </section>
    </div>
  );
}
