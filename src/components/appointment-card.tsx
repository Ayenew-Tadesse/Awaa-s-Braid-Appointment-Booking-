"use client";
// One appointment: when, what, with whom, the price and its status.
import type { Appointment, Dataset } from "@/lib/domain/types";
import { formatDay, formatMoney, formatTime } from "@/lib/domain/time";
import { useT } from "@/lib/i18n";
import { StatusBadge } from "./ui";

export function AppointmentCard({ a, data, showCustomer = false, actions }: { a: Appointment; data: Dataset; showCustomer?: boolean; actions?: React.ReactNode }) {
  const t = useT();
  const tz = data.salon.timezone;
  const stylist = data.stylists.find((s) => s.id === a.stylist_id)?.name ?? "";
  const customer = data.people.find((p) => p.id === a.customer_id);
  const opts = a.options.map((o) => o.label).join(" · ");
  return (
    <article className="card flex gap-3 p-3.5" data-appointment={a.id}>
      <div className="w-[4.75rem] shrink-0 whitespace-nowrap text-center">
        <p className="text-xs text-muted">{formatDay(a.starts_at, tz)}</p>
        <p className="text-[0.95rem] font-semibold tabular-nums">{formatTime(a.starts_at, tz)}</p>
        <p className="muted text-xs tabular-nums">{formatTime(a.ends_at, tz)}</p>
      </div>
      <div className="min-w-0 flex-1 border-l border-line pl-3">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <h3 className="font-semibold leading-snug">{showCustomer ? customer?.full_name ?? "" : a.style_name}</h3>
          <StatusBadge status={a.status} label={t(`status.${a.status}`)} />
        </div>
        <p className="muted text-sm">
          {showCustomer ? `${a.style_name}${opts ? ` · ${opts}` : ""}` : opts}
          {(showCustomer || opts) && <br />}
          {t("home.with", { name: stylist })} · {formatMoney(a.price, data.salon.currency)}
        </p>
        {showCustomer && customer?.phone && <a className="mt-1 inline-block text-sm text-brand underline" href={`tel:${customer.phone.replace(/\s/g, "")}`}>{customer.phone}</a>}
        {actions}
      </div>
    </article>
  );
}
