"use client";
// One stylist's schedule, for the salon: their working week, time off and every
// upcoming job (with the address and a map link), each day's jobs ready to send
// to them (stylists don't sign in), and taking them off the team once their
// upcoming appointments have moved to someone else.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { errorText } from "@/lib/data/store";
import { mapsUrl } from "@/lib/domain/booking";
import { freeAt, jobLines, upcomingFor } from "@/lib/domain/team";
import { clockLabel, formatDay, formatTime, localDay } from "@/lib/domain/time";
import type { Appointment } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { AppointmentSheet } from "./appointment-sheet";
import { ConfirmDialog } from "./confirm-dialog";
import { Icon } from "./icons";
import { DAYS, StylistEditor, TimeOffEditor } from "./manage-team";
import { useToast } from "./toast";
import { Card, Empty, PageHeader, StatusBadge } from "./ui";

export function StylistSchedule({ id }: { id: string }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const tz = data.salon.timezone;
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [addingOff, setAddingOff] = useState(false);
  const [open, setOpen] = useState<Appointment | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [email, setEmail] = useState("");

  const s = data.stylists.find((x) => x.id === id);
  const jobs = useMemo(() => upcomingFor(id, data.appointments, now), [id, data.appointments, now]);
  const days = useMemo(() => [...new Set(jobs.map((a) => localDay(new Date(a.starts_at), tz)))], [jobs, tz]);
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;
  const back = <Link href="/app/salon/team" className="muted mb-2 inline-flex items-center gap-1 text-sm"><Icon name="chevron" size={16} className="rotate-180" />{t("salon.team")}</Link>;
  if (!s || s.removed_at) return <>{back}<Empty text={removed ? t("salon.removed") : t("salon.notFound")} /></>;

  const others = data.stylists.filter((x) => x.active && !x.removed_at && x.id !== id);
  const timeOff = data.timeOff.filter((x) => x.stylist_id === id && Date.parse(x.ends_at) > now.getTime()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const time = (iso: string) => formatTime(iso, tz);

  const send = async (day: string) => {
    const list = jobs.filter((a) => localDay(new Date(a.starts_at), tz) === day);
    const text = [`${s.name} · ${formatDay(list[0].starts_at, tz, { weekday: "long" })}`, ...jobLines(list, data.people, time)].join("\n\n");
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: data.salon.name, text });
      else { await navigator.clipboard.writeText(text); toast(t("salon.copied")); }
    } catch { /* closed the share menu */ }
  };

  const moveAll = async () => {
    const to = others.find((x) => x.id === moveTo);
    if (!to) return;
    setBusy(true);
    let moved = 0, left = 0;
    try {
      // One by one, against the latest diary, so two jobs can't land on top of each other.
      for (const a of jobs) {
        const latest = await store.load();
        if (freeAt(a, to.id, latest, new Date())) { await store.reschedule(a.id, a.starts_at, to.id); moved++; } else left++;
      }
    } catch (e) { toast(errorText(e), "error"); }
    await reload();
    setBusy(false);
    toast(left ? t("salon.movedSome", { moved, left, name: to.name }) : t("salon.movedAll", { moved, name: to.name }), left ? "error" : undefined);
  };

  const login = s.profile_id ? data.people.find((p) => p.id === s.profile_id) ?? { full_name: "", phone: null } : null;
  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await store.linkLogin(id, email); setEmail(""); await reload(); toast(t("salon.linked")); }
    catch (err) { toast(errorText(err), "error"); }
    finally { setBusy(false); }
  };
  const unlink = async () => {
    setBusy(true);
    try { await store.unlinkLogin(id); await reload(); toast(t("salon.unlinked")); }
    catch (err) { toast(errorText(err), "error"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await store.removeStylist(id); setRemoved(true); await reload(); toast(t("salon.removedToast", { name: s.name })); }
    catch (e) { toast(errorText(e), "error"); }
    finally { setBusy(false); setAsking(false); }
  };

  return (
    <>
      {back}
      <PageHeader title={s.name} subtitle={s.bio ?? undefined}
        action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} data-edit-stylist><Icon name="sparkle" size={16} />{t("common.edit")}</button>} />
      {!s.active && <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm" data-paused>{t("salon.paused")}</p>}

      <div className="space-y-4">
        <Card title={t("salon.login")}>
          {login ? (
            <div className="flex flex-wrap items-center gap-3" data-login>
              <p className="min-w-0 flex-1 text-sm">{t("salon.loginLinked", { name: login.full_name || "—" })}{login.phone ? <span className="muted block">{login.phone}</span> : null}</p>
              <button type="button" className="btn btn-ghost btn-sm text-bad" disabled={busy} onClick={unlink} data-unlink>{t("salon.unlink")}</button>
            </div>
          ) : (
            <form className="space-y-2" onSubmit={link} data-link-form>
              <p className="muted text-sm">{t("salon.loginHint")}</p>
              <label className="label" htmlFor="login-email">{t("salon.loginEmail")}</label>
              <div className="flex gap-2">
                <input id="login-email" type="email" autoComplete="off" className="input min-w-0 flex-1" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()} data-link>{t("salon.link")}</button>
              </div>
            </form>
          )}
        </Card>

        <Card title={t("salon.week")}>
          <ul className="space-y-1 text-sm" data-week>
            {DAYS.map((d) => {
              const blocks = data.hours.filter((h) => h.stylist_id === id && h.weekday === d).sort((a, b) => a.starts.localeCompare(b.starts));
              return (
                <li key={d} className="flex justify-between gap-3">
                  <span>{t(`salon.days.${d}`)}</span>
                  <span className={blocks.length ? "tabular-nums" : "muted"}>{blocks.length ? blocks.map((b) => `${clockLabel(b.starts)} – ${clockLabel(b.ends)}`).join(", ") : t("salon.off")}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={t("salon.timeOff")} action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingOff(true)} data-add-time-off><Icon name="plus" size={16} />{t("salon.addTimeOff")}</button>}>
          {timeOff.length ? (
            <ul className="divide-y divide-line text-sm" data-stylist-time-off>
              {timeOff.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">{formatDay(x.starts_at, tz)} {time(x.starts_at)} – {localDay(new Date(x.ends_at), tz) !== localDay(new Date(x.starts_at), tz) ? `${formatDay(x.ends_at, tz)} ` : ""}{time(x.ends_at)}{x.reason ? <span className="muted"> · {x.reason}</span> : null}</span>
                  <button type="button" className="text-sm font-semibold text-bad underline"
                    onClick={async () => { try { await store.removeTimeOff(x.id); await reload(); toast(t("common.saved")); } catch (e) { toast(errorText(e), "error"); } }}>{t("common.remove")}</button>
                </li>
              ))}
            </ul>
          ) : <p className="muted text-sm">{t("salon.noTimeOff")}</p>}
        </Card>

        <section aria-labelledby="jobs">
          <h2 id="jobs" className="mb-2 font-semibold">{t("salon.jobs")}</h2>
          {!days.length ? <Empty icon="calendar" text={t("salon.noJobs")} /> : (
            <div className="space-y-4" data-jobs>
              {days.map((day) => {
                const list = jobs.filter((a) => localDay(new Date(a.starts_at), tz) === day);
                return (
                  <div key={day} data-job-day={day}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <h3 className="muted text-sm">{formatDay(list[0].starts_at, tz, { weekday: "long" })}</h3>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => send(day)} data-send-day={day}><Icon name="arrow" size={16} />{t("salon.sendDay")}</button>
                    </div>
                    <ul className="space-y-2">
                      {list.map((a) => {
                        const c = data.people.find((p) => p.id === a.customer_id);
                        return (
                          <li key={a.id} className="card p-3.5" data-job>
                            <button type="button" className="w-full text-left" onClick={() => setOpen(a)}>
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold tabular-nums">{time(a.starts_at)} – {time(a.ends_at)}</span>
                                <StatusBadge status={a.status} label={t(`status.${a.status}`)} />
                              </span>
                              <span className="block text-sm">{a.style_name} · {c?.full_name}</span>
                              {a.visit_address && <span className="muted block text-sm">{a.visit_address}, {a.visit_city} {a.visit_zip}</span>}
                            </button>
                            {a.visit_address && <a href={mapsUrl(a)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand underline"><Icon name="pin" size={16} />{t("sheet.openMap")}</a>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Card title={t("salon.removeTitle")}>
          {jobs.length ? (
            <div className="space-y-3" data-move-all>
              <p className="muted text-sm">{t("salon.removeFirst", { n: jobs.length })}</p>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="move-to">{t("salon.moveTo")}</label>
                <select id="move-to" className="input min-w-0 flex-1" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">{t("salon.moveTo")}</option>
                  {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button type="button" className="btn btn-primary" disabled={!moveTo || busy} onClick={moveAll} data-move-all-go>{busy ? t("common.saving") : t("salon.moveAll")}</button>
              </div>
              <p className="muted text-xs">{t("salon.moveAllHint")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="muted text-sm">{t("salon.removeHint")}</p>
              <button type="button" className="btn btn-ghost w-full text-bad" disabled={busy} onClick={() => setAsking(true)} data-remove-stylist>{t("salon.remove", { name: s.name })}</button>
            </div>
          )}
        </Card>
      </div>

      {editing && <StylistEditor stylist={s} onClose={() => setEditing(false)} />}
      {addingOff && <TimeOffEditor stylistId={id} onClose={() => setAddingOff(false)} />}
      {open && <AppointmentSheet appointment={open} onClose={() => setOpen(null)} />}
      {asking && <ConfirmDialog title={t("salon.removeSure", { name: s.name })} body={t("salon.removeSureBody")} keep={t("sheet.keep")} confirm={t("salon.remove", { name: s.name })}
        busy={busy} onConfirm={remove} onClose={() => setAsking(false)} />}
    </>
  );
}
