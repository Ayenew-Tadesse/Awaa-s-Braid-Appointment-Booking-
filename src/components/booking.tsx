"use client";
// Booking in five steps, phone first: style → size and length → date, stylist
// and a free time → where the stylist should come → review and send. Only times that are really free are
// offered (domain/booking.ts); the server checks everything again on sending.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { errorText } from "@/lib/data/store";
import { addressProblem, areaLabel, bookableDays, freeSlots, MAX_UPCOMING, optionsProblem, quote, type Address, type Busy, type Slot } from "@/lib/domain/booking";
import { addDays, at, formatDay, formatDuration, formatMoney, formatTime, localDay, getDateLocale } from "@/lib/domain/time";
import { isOpen, type Style, type StyleOption } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { styleRange } from "./style-list";
import { StyleArt } from "./style-art";
import { useToast } from "./toast";
import { Empty, Spinner } from "./ui";

type Step = 1 | 2 | 3 | 4 | 5 | "sent";

export function Booking({ initialStyle }: { initialStyle?: string | null }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const { salon } = data;
  const tz = salon.timezone;
  const money = (n: number) => formatMoney(n, salon.currency);
  const [now] = useState(() => new Date()); // when the screen opened

  const preset = data.styles.find((s) => s.id === initialStyle && s.active);
  const [step, setStep] = useState<Step>(!preset ? 1 : data.options.some((o) => o.style_id === preset.id) ? 2 : 3);
  const [styleId, setStyleId] = useState<string | null>(preset?.id ?? null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [stylist, setStylist] = useState<string | null>(null); // null = any stylist
  const [day, setDay] = useState<string>(() => localDay(now, tz));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  // Where to come: the address saved from the last booking, if any.
  const [place, setPlace] = useState<Address>(() => ({ address: data.me.address ?? "", city: data.me.city ?? "", zip: data.me.zip ?? "" }));
  const [placeTried, setPlaceTried] = useState(false);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style = data.styles.find((s) => s.id === styleId) ?? null;
  const myOptions = useMemo(() => (style ? data.options.filter((o) => o.style_id === style.id).sort((a, b) => a.sort - b.sort) : []), [style, data.options]);
  const chosen = myOptions.filter((o) => optionIds.includes(o.id));
  const q = style ? quote(style, chosen) : null;
  const problem = style ? optionsProblem(style, data.options, optionIds) : null;
  const upcoming = data.appointments.filter((a) => a.customer_id === data.me.id && isOpen(a) && Date.parse(a.starts_at) > now.getTime()).length;

  // Busy times for the next two weeks, fetched when the time step opens (and again after a clash).
  const days = useMemo(() => bookableDays(salon, now), [salon, now]);
  useEffect(() => {
    if (step !== 3 || busy) return;
    let live = true;
    store.busyTimes(now.toISOString(), at(addDays(days.at(-1)!, 1), "00:00", tz).toISOString())
      .then((b) => { if (live) setBusy(b); }, (e) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [step, busy, store, now, days, tz]);

  const slotsFor = (d: string) => (q && busy ? freeSlots({ salon, stylists: data.stylists, hours: data.hours, busy, day: d, minutes: q.minutes, now, only: stylist }) : []);
  const slots = slotsFor(day);
  const stylistName = (id: string) => data.stylists.find((s) => s.id === id)?.name ?? "";

  const pickStyle = (s: Style) => {
    setStyleId(s.id); setOptionIds([]); setSlot(null); setError(null);
    setStep(data.options.some((o) => o.style_id === s.id) ? 2 : 3);
  };
  const toggle = (o: StyleOption) => {
    setSlot(null);
    setOptionIds((ids) => (o.kind === "extra"
      ? (ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id])
      : [...ids.filter((x) => myOptions.find((m) => m.id === x)?.kind !== o.kind), o.id]));
  };
  const placeProblem = addressProblem(place, salon);
  const back = () => { setError(null); setStep((s) => (s === 5 ? 4 : s === 4 ? 3 : s === 3 ? (myOptions.length ? 2 : 1) : 1)); };

  const send = async () => {
    if (!style || !slot) return;
    setSending(true); setError(null);
    try {
      await store.book({ styleId: style.id, optionIds, stylistId: stylist, startsAt: slot.startsAt, note, address: place });
      await reload();
      setStep("sent");
    } catch (e) {
      const msg = errorText(e);
      if (/no longer free|offered times/i.test(msg)) { setBusy(null); setSlot(null); setStep(3); setError(t("book.taken")); }
      else if (/address|ZIP/i.test(msg)) { setStep(4); setPlaceTried(true); setError(msg); }
      else setError(msg);
      toast(msg, "error");
    } finally { setSending(false); }
  };

  if (data.me.role === "admin") return <Empty icon="calendar" text={t("book.adminOnly")} />;
  if (upcoming >= MAX_UPCOMING && step !== "sent") return <Empty icon="calendar" text={t("book.limit", { n: MAX_UPCOMING })}><Link href="/app" className="btn btn-ghost btn-sm mt-2">{t("book.seeAppointments")}</Link></Empty>;

  if (step === "sent" && style && slot) {
    return (
      <div className="card p-5 text-center" data-booking-sent>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-good-soft text-good"><Icon name="check" size={28} /></span>
        <h1 className="mt-3 text-xl font-semibold">{t("book.sentTitle")}</h1>
        <p className="muted mt-1 text-sm">{t("book.sentBody")}</p>
        <p className="mt-4 font-semibold">{style.name}</p>
        <p className="muted text-sm">{formatDay(slot.startsAt, tz, { weekday: "long" })} · {formatTime(slot.startsAt, tz)}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/app" className="btn btn-primary">{t("book.seeAppointments")}</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setStyleId(null); setOptionIds([]); setSlot(null); setNote(""); setBusy(null); }}>{t("book.another")}</button>
        </div>
      </div>
    );
  }

  const n = step as 1 | 2 | 3 | 4 | 5;
  const stepName = (["style", "options", "time", "place", "review"] as const)[n - 1];
  const groups = (["size", "length", "extra"] as const).map((k) => [k, myOptions.filter((o) => o.kind === k)] as const).filter(([, list]) => list.length);
  const partOfDay = (iso: string) => { const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date(iso))); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

  return (
    <div className="pb-24" data-booking data-step={n}>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {n > 1 && <button type="button" onClick={back} className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label={t("common.back")} data-back><Icon name="arrow" size={18} className="rotate-180" /></button>}
          <div className="min-w-0">
            <p className="muted text-xs">{t("book.step", { n })}</p>
            <h1 className="text-xl font-semibold leading-tight">{t(`book.steps.${stepName}`)}</h1>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-1.5 rounded-full ${i <= n ? "bg-brand" : "bg-line"}`} />)}
        </div>
      </div>

      {error && <p className="mb-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}

      {n === 1 && (
        <ul className="grid gap-2.5 sm:grid-cols-2" aria-label={t("book.pickStyle")}>
          {[...data.styles].filter((s) => s.active).sort((a, b) => a.sort - b.sort).map((s) => {
            const r = styleRange(s, data.options);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => pickStyle(s)} data-pick-style={s.name}
                  className={`card flex w-full overflow-hidden text-left transition hover:border-brand ${styleId === s.id ? "border-brand ring-2 ring-brand/30" : ""}`}>
                  <StyleArt category={s.category} className="h-auto w-20 shrink-0" />
                  <span className="min-w-0 flex-1 p-3">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-sm font-semibold text-brand">{t("styles.from", { price: money(r.price) })}</span>
                    <span className="muted block text-xs">{t("styles.takes", { time: formatDuration(r.minutes) })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {n === 2 && style && (
        <div className="space-y-5">
          <p className="font-semibold">{style.name}</p>
          {groups.map(([kind, list]) => (
            <fieldset key={kind}>
              <legend className="label">{t(kind === "extra" ? "book.extras" : `book.${kind}`)}</legend>
              <div className="flex flex-wrap gap-2">
                {list.map((o) => {
                  const on = optionIds.includes(o.id);
                  const extra = [o.extra_price ? `${o.extra_price > 0 ? "+" : "−"}${money(Math.abs(o.extra_price))}` : "", o.extra_minutes ? `${o.extra_minutes > 0 ? "+" : "−"}${formatDuration(Math.abs(o.extra_minutes))}` : ""].filter(Boolean).join(" · ");
                  return (
                    <button key={o.id} type="button" role={kind === "extra" ? "checkbox" : "radio"} aria-checked={on} onClick={() => toggle(o)} data-option={o.label}
                      className={`min-h-12 rounded-2xl border px-4 py-2 text-left text-sm ${on ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface"}`}>
                      <span className="block font-semibold">{o.label}</span>
                      {extra && <span className="muted block text-xs">{extra}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {n === 3 && q && (
        <div className="space-y-5">
          <fieldset>
            <legend className="label">{t("book.stylist")}</legend>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {[null, ...data.stylists.filter((s) => s.active).map((s) => s.id)].map((id) => (
                <button key={id ?? "any"} type="button" role="radio" aria-checked={stylist === id} data-stylist={id ? stylistName(id) : "any"}
                  onClick={() => { setStylist(id); setSlot(null); }}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${stylist === id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-surface"}`}>
                  {id ? stylistName(id) : t("book.anyStylist")}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">{t("book.day")}</legend>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-days>
              {days.map((d) => {
                const free = busy ? slotsFor(d).length : null;
                const noon = at(d, "12:00", tz).toISOString();
                return (
                  <button key={d} type="button" role="radio" aria-checked={day === d} data-day={d} disabled={free === 0}
                    onClick={() => { setDay(d); setSlot(null); }}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2 text-sm disabled:opacity-45 ${day === d ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"}`}>
                    <span className="text-xs opacity-80">{new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, weekday: "short" }).format(new Date(noon))}</span>
                    <span className="text-lg font-semibold leading-tight">{new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, day: "numeric" }).format(new Date(noon))}</span>
                    <span className="text-[0.7rem] opacity-80">{free === 0 ? t("book.noTimesShort") : new Intl.DateTimeFormat(getDateLocale(), { timeZone: tz, month: "short" }).format(new Date(noon))}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <section aria-label={t("book.times")}>
            {!busy ? <div className="muted flex items-center gap-2 py-6 text-sm" role="status"><Spinner />{t("book.loadingTimes")}</div>
              : !slots.length ? <Empty text={t("book.noTimes")} />
              : (["morning", "afternoon", "evening"] as const).map((part) => {
                  const list = slots.filter((s) => partOfDay(s.startsAt) === part);
                  if (!list.length) return null;
                  return (
                    <div key={part} className="mb-4">
                      <h2 className="muted mb-2 text-sm">{t(`book.${part}`)}</h2>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-slots>
                        {list.map((s) => (
                          <button key={s.startsAt} type="button" role="radio" aria-checked={slot?.startsAt === s.startsAt} onClick={() => setSlot(s)} data-slot={formatTime(s.startsAt, tz)}
                            className={`min-h-12 rounded-xl border text-sm font-semibold tabular-nums ${slot?.startsAt === s.startsAt ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"}`}>
                            {formatTime(s.startsAt, tz)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
          </section>
        </div>
      )}

      {n === 4 && (
        <div className="space-y-4" data-place>
          <p className="muted text-sm">{t("book.placeLead", { area: areaLabel(salon.service_zips) })}</p>
          <div>
            <label htmlFor="address" className="label">{t("book.address")}</label>
            <input id="address" className="input" autoComplete="street-address" maxLength={200} value={place.address} placeholder={t("book.addressPlaceholder")}
              onChange={(e) => setPlace({ ...place, address: e.target.value })} aria-invalid={placeTried && placeProblem === "address"} />
          </div>
          <div className="grid grid-cols-[1fr_7.5rem] gap-3">
            <div className="min-w-0">
              <label htmlFor="city" className="label">{t("book.city")}</label>
              <input id="city" className="input" autoComplete="address-level2" maxLength={80} value={place.city} placeholder={t("book.cityPlaceholder")}
                onChange={(e) => setPlace({ ...place, city: e.target.value })} aria-invalid={placeTried && placeProblem === "address"} />
            </div>
            <div>
              <label htmlFor="zip" className="label">{t("book.zip")}</label>
              <input id="zip" className="input tabular-nums" autoComplete="postal-code" inputMode="numeric" maxLength={5} value={place.zip}
                onChange={(e) => setPlace({ ...place, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} aria-invalid={placeTried && placeProblem !== null && placeProblem !== "address"} />
            </div>
          </div>
          {placeTried && placeProblem && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="alert" data-place-problem={placeProblem}>
              {placeProblem === "area" ? t("book.outsideArea", { area: areaLabel(salon.service_zips), phone: salon.phone ?? "" }) : t(placeProblem === "zip" ? "book.badZip" : "book.needAddress")}
            </p>
          )}
          <p className="muted text-xs">{t("book.placePrivate")}</p>
        </div>
      )}

      {n === 5 && style && q && slot && (
        <div className="space-y-4">
          <section className="card divide-y divide-line" data-review>
            <div className="flex gap-3 p-4">
              <StyleArt category={style.category} className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="font-semibold">{style.name}</p>
                {chosen.length > 0 && <p className="muted text-sm">{chosen.map((o) => o.label).join(" · ")}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 p-4 text-sm">
              <dt className="muted">{t("book.when")}</dt>
              <dd>{formatDay(slot.startsAt, tz, { weekday: "long" })}<br />{formatTime(slot.startsAt, tz)} – {formatTime(slot.endsAt, tz)} ({formatDuration(q.minutes)})</dd>
              <dt className="muted">{t("book.with")}</dt>
              <dd>{stylist ? stylistName(stylist) : t("book.firstFree")}</dd>
              <dt className="muted">{t("book.where")}</dt>
              <dd data-review-place>{place.address.trim()}<br />{place.city.trim()} {place.zip.trim()}</dd>
              <dt className="muted">{t("book.price")}</dt>
              <dd className="font-semibold">{t("book.payAtSalon", { price: money(q.price) })}</dd>
            </dl>
          </section>
          <div>
            <label htmlFor="note" className="label">{t("book.note")}</label>
            <textarea id="note" className="input min-h-24" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("book.notePlaceholder")} />
          </div>
          <p className="muted text-xs">{t("book.policy", { hours: salon.cancel_hours })}</p>
        </div>
      )}

      {/* The running total and the next step, always within reach of a thumb. */}
      {n > 1 && q && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 backdrop-blur sm:bottom-0" data-summary>
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm leading-tight"><span className="block font-semibold">{money(q.price)}</span><span className="muted block text-xs">{formatDuration(q.minutes)}</span>
              {n === 2 && problem && <span className="block text-xs text-muted">{problem === "Choose a size." ? t("book.pickSize") : problem === "Choose a length." ? t("book.pickLength") : problem}</span>}
            </p>
            {n === 2 && <button type="button" className="btn btn-primary" disabled={!!problem} onClick={() => { setError(null); setStep(3); }} data-next>{t("common.continue")}</button>}
            {n === 3 && <button type="button" className="btn btn-primary" disabled={!slot} onClick={() => { setError(null); setStep(4); }} data-next>{t("common.continue")}</button>}
            {n === 4 && <button type="button" className="btn btn-primary" onClick={() => { setError(null); setPlaceTried(true); if (!placeProblem) setStep(5); }} data-next>{t("common.continue")}</button>}
            {n === 5 && <button type="button" className="btn btn-primary" disabled={sending} onClick={send} data-confirm>{sending ? t("book.sending") : t("book.confirm")}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
