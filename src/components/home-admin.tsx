"use client";
// The salon's day: today's diary, requests waiting to be confirmed, and the week in numbers.
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { addDays, at, formatDay, formatMoney, localDay, weekdayOf } from "@/lib/domain/time";
import { isOpen } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { AppointmentCard } from "./appointment-card";
import { Card, Empty, Stat } from "./ui";

export function AdminHome() {
  const t = useT();
  const { data } = useApp();
  const tz = data.salon.timezone;
  const [now] = useState(() => new Date()); // when the screen opened
  const today = localDay(now, tz);
  const dayOf = (iso: string) => localDay(new Date(iso), tz);
  // The week runs Monday to Sunday.
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const [weekStart, weekEnd] = [at(monday, "00:00", tz).getTime(), at(addDays(monday, 7), "00:00", tz).getTime()];

  const todays = data.appointments.filter((a) => dayOf(a.starts_at) === today && a.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const requests = data.appointments.filter((a) => a.status === "pending" && Date.parse(a.starts_at) > now.getTime()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const week = data.appointments.filter((a) => Date.parse(a.starts_at) >= weekStart && Date.parse(a.starts_at) < weekEnd);
  const weekOpen = week.filter((a) => isOpen(a) || a.status === "completed");
  const income = weekOpen.reduce((sum, a) => sum + a.price, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
        <p className="muted text-sm">{formatDay(now.toISOString(), tz, { weekday: "long", year: true })}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" data-admin-stats>
        <Stat icon="calendar" label={t("admin.today")} value={String(todays.length)} />
        <Stat icon="inbox" label={t("admin.requests")} value={String(requests.length)} />
        <Stat icon="users" label={t("admin.week")} value={String(weekOpen.length)} />
        <Stat icon="money" label={t("admin.income")} value={formatMoney(income, data.salon.currency)} />
      </div>
      <Card title={t("admin.schedule")}>
        <div className="space-y-2.5" data-today-list>
          {todays.length ? todays.map((a) => <AppointmentCard key={a.id} a={a} data={data} showCustomer />) : <Empty text={t("admin.empty")} />}
        </div>
      </Card>
      <Card title={t("admin.newRequests")}>
        <div className="space-y-2.5" data-requests>
          {requests.length ? requests.map((a) => <AppointmentCard key={a.id} a={a} data={data} showCustomer />) : <Empty icon="check" text={t("admin.noRequests")} />}
        </div>
      </Card>
    </div>
  );
}
