"use client";
// The salon's view of one appointment: who, what, when, where (with a map link), the note, and what can
// be done now (domain/salon.ts): confirm, decline, move, cancel, done or missed.
// Moving offers only times when the chosen stylist is free (same length).
import { useMemo, useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { errorText } from "@/lib/data/store";
import { busyFrom, freeSlots, mapsUrl, type Slot } from "@/lib/domain/booking";
import { ACTION_STATUS, salonActions, type SalonAction } from "@/lib/domain/salon";
import { addDays, at, formatDay, formatDuration, formatMoney, formatSlot, formatTime, localDay, getDateLocale } from "@/lib/domain/time";
import type { Appointment } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { ConfirmDialog } from "./confirm-dialog";
import { Icon } from "./icons";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { Empty, StatusBadge } from "./ui";

export function AppointmentSheet({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const tz = data.salon.timezone;
  const [now] = useState(() => new Date());
  const a = data.appointments.find((x) => x.id === appointment.id) ?? appointment;
  const customer = data.people.find((p) => p.id === a.customer_id);
  const minutes = (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000;
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<"decline" | "cancel" | null>(null);
  const [moving, setMoving] = useState(false);

  const act = async (action: Exclude<SalonAction, "reschedule">) => {
    setBusy(true);
    try { await store.setStatus(a.id, ACTION_STATUS[action]); await reload(); toast(t(`sheet.toast.${action}`)); setAsking(null); }
    catch (e) { toast(errorText(e), "error"); }
    finally { setBusy(false); }
  };

  if (moving) return <MoveSheet a={a} minutes={minutes} onDone={() => { setMoving(false); onClose(); }} onBack={() => setMoving(false)} />;

  const actions = salonActions(a, now);
  const phone = customer?.phone?.replace(/[^\d+]/g, "");
  return (
    <Sheet title={customer?.full_name ?? a.style_name} onClose={onClose}>
      <div className="mb-4"><StatusBadge status={a.status} label={t(`status.${a.status}`)} /></div>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="muted">{t("sheet.style")}</dt><dd>{a.style_name}{a.options.length ? ` · ${a.options.map((o) => o.label).join(" · ")}` : ""}</dd>
        <dt className="muted">{t("sheet.when")}</dt><dd>{formatSlot(a.starts_at, a.ends_at, tz)}<br /><span className="muted">{formatDuration(minutes)}</span></dd>
        <dt className="muted">{t("sheet.stylist")}</dt><dd>{data.stylists.find((s) => s.id === a.stylist_id)?.name}</dd>
        <dt className="muted">{t("sheet.price")}</dt><dd className="font-semibold">{formatMoney(a.price, data.salon.currency)}</dd>
        {a.visit_address && <><dt className="muted">{t("sheet.where")}</dt><dd data-sheet-place>{a.visit_address}<br />{[a.visit_city, a.visit_zip].filter(Boolean).join(" ")}</dd></>}
        {a.note && <><dt className="muted">{t("sheet.note")}</dt><dd className="whitespace-pre-wrap">{a.note}</dd></>}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {phone && <a href={`tel:${phone}`} className="btn btn-ghost btn-sm"><Icon name="phone" size={16} />{t("sheet.call", { name: customer!.full_name.split(" ")[0] })}</a>}
        {a.visit_address && <a href={mapsUrl(a)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" data-map><Icon name="pin" size={16} />{t("sheet.openMap")}</a>}
      </div>
      <div className="mt-5 grid gap-2" data-actions>
        {!actions.length && <p className="muted text-sm">{t("sheet.final")}</p>}
        {actions.map((x) => (
          <button key={x} type="button" disabled={busy} data-action={x}
            onClick={() => (x === "reschedule" ? setMoving(true) : x === "decline" || x === "cancel" ? setAsking(x) : act(x))}
            className={`btn ${x === "confirm" || x === "done" ? "btn-primary" : x === "decline" || x === "cancel" || x === "no_show" ? "btn-ghost text-bad" : "btn-ghost"}`}>
            {t(`sheet.actions.${x}`)}
          </button>
        ))}
      </div>
      {asking && (
        <ConfirmDialog title={t(`sheet.sure.${asking}`)} body={t("sheet.sureBody")} keep={t("sheet.keep")} confirm={t(`sheet.actions.${asking}`)}
          busy={busy} onConfirm={() => act(asking)} onClose={() => setAsking(null)} />
      )}
    </Sheet>
  );
}

function MoveSheet({ a, minutes, onDone, onBack }: { a: Appointment; minutes: number; onDone: () => void; onBack: () => void }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const tz = data.salon.timezone;
  const [now] = useState(() => new Date());
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(localDay(now, tz), i)), [now, tz]);
  const [stylist, setStylist] = useState(a.stylist_id);
  const [day, setDay] = useState(() => localDay(new Date(a.starts_at), tz));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  // Everyone else's bookings and time off (not this appointment itself).
  const busy = useMemo(() => busyFrom(data.appointments.filter((x) => x.id !== a.id), data.timeOff, data.salon.travel_minutes), [data, a.id]);
  const slots = freeSlots({ salon: data.salon, stylists: data.stylists, hours: data.hours, busy, day, minutes, now, only: stylist, forSalon: true });

  const save = async () => {
    if (!slot) return;
    setSaving(true);
    try { await store.reschedule(a.id, slot.startsAt, stylist); await reload(); toast(t("sheet.toast.reschedule")); onDone(); }
    catch (e) { toast(errorText(e), "error"); }
    finally { setSaving(false); }
  };

  return (
    <Sheet title={t("sheet.moveTitle")} onClose={onBack}>
      <p className="muted mb-4 text-sm">{t("sheet.moveHint", { time: formatDuration(minutes), travel: formatDuration(data.salon.travel_minutes) })}</p>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t("sheet.stylist")}>
        {data.stylists.filter((s) => s.active).map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={stylist === s.id} onClick={() => { setStylist(s.id); setSlot(null); }} data-move-stylist={s.name}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${stylist === s.id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-surface"}`}>{s.name}</button>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t("book.day")} data-move-days>
        {days.map((d) => {
          const noon = at(d, "12:00", tz).toISOString();
          return (
            <button key={d} type="button" role="radio" aria-checked={day === d} onClick={() => { setDay(d); setSlot(null); }} data-day={d}
              className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-1.5 text-sm ${day === d ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"}`}>
              <span className="text-xs opacity-80">{new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, weekday: "short" }).format(new Date(noon))}</span>
              <span className="font-semibold">{new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, day: "numeric" }).format(new Date(noon))}</span>
            </button>
          );
        })}
      </div>
      {slots.length ? (
        <div className="grid grid-cols-3 gap-2" data-move-slots>
          {slots.map((s) => (
            <button key={s.startsAt} type="button" role="radio" aria-checked={slot?.startsAt === s.startsAt} onClick={() => setSlot(s)} data-slot={formatTime(s.startsAt, tz)}
              className={`min-h-11 rounded-xl border text-sm font-semibold tabular-nums ${slot?.startsAt === s.startsAt ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"}`}>{formatTime(s.startsAt, tz)}</button>
          ))}
        </div>
      ) : <Empty text={t("book.noTimes")} />}
      <div className="mt-5 flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={onBack}>{t("common.back")}</button>
        <button type="button" className="btn btn-primary flex-1" disabled={!slot || saving} onClick={save} data-move-save>
          {saving ? t("common.saving") : slot ? `${t("sheet.save")} · ${formatDay(slot.startsAt, tz)} ${formatTime(slot.startsAt, tz)}` : t("sheet.save")}
        </button>
      </div>
    </Sheet>
  );
}
