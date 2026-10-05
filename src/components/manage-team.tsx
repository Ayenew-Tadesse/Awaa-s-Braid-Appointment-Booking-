"use client";
// The salon's team, managed by the admin: each stylist's working week (one or
// two blocks a day, so a break can sit between them) and time off. Customers are
// only offered times inside these hours; the reason for time off stays with the
// salon. Tap a stylist for their schedule page (stylist-schedule.tsx).
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { errorText, type HoursDraft, type StylistDraft } from "@/lib/data/store";
import { hoursProblem } from "@/lib/domain/salon";
import { addDays, at, formatDay, formatTime, localDay } from "@/lib/domain/time";
import { upcomingFor } from "@/lib/domain/team";
import type { Stylist } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { Card, Empty, PageHeader } from "./ui";

export const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function ManageTeam() {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const tz = data.salon.timezone;
  const [editing, setEditing] = useState<"new" | null>(null);
  const [adding, setAdding] = useState(false);
  const [now] = useState(() => Date.now());
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;
  const summary = (id: string) => weekSummary(id, data.hours, t);
  const team = data.stylists.filter((s) => !s.removed_at).sort((a, b) => a.sort - b.sort);
  // Accounts that signed up on the staff website to join the team.
  const waiting = data.people.filter((p) => p.role === "customer" && p.wants_stylist);
  const upcoming = data.timeOff.filter((x) => Date.parse(x.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const remove = async (id: string) => {
    try { await store.removeTimeOff(id); await reload(); toast(t("common.saved")); } catch (e) { toast(errorText(e), "error"); }
  };

  return (
    <>
      <Link href="/app/salon" className="muted mb-2 inline-flex items-center gap-1 text-sm"><Icon name="chevron" size={16} className="rotate-180" />{t("salon.title")}</Link>
      <PageHeader title={t("salon.team")} action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")} data-add-stylist><Icon name="plus" size={16} />{t("salon.addStylist")}</button>} />
      <ul className="space-y-2.5">
        {team.map((s) => {
          const jobs = upcomingFor(s.id, data.appointments, new Date(now)).length;
          return (
            <li key={s.id}>
              <Link href={`/app/salon/team/${s.id}`} className="card flex w-full items-center gap-3 p-3.5 text-left hover:border-brand" data-manage-stylist={s.name}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="font-semibold">{s.name}</span>{!s.active && <span className="badge badge-cancelled">{t("salon.hidden")}</span>}</span>
                  <span className="muted block text-sm">{summary(s.id)}</span>
                  <span className="muted block text-xs">{t("salon.jobsCount", { n: jobs })}</span>
                </span>
                <Icon name="chevron" className="text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>

      {waiting.length > 0 && (
        <Card className="mt-5" title={t("salon.waiting")}>
          <p className="muted mb-2 text-sm">{t("salon.waitingHint")}</p>
          <ul className="divide-y divide-line" data-waiting>
            {waiting.map((p) => <WaitingRow key={p.id} id={p.id} name={p.full_name} phone={p.phone} />)}
          </ul>
        </Card>
      )}

      <Card className="mt-5" title={t("salon.timeOff")} action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)} data-add-time-off><Icon name="plus" size={16} />{t("salon.addTimeOff")}</button>}>
        {upcoming.length ? (
          <ul className="divide-y divide-line" data-time-off-list>
            {upcoming.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-semibold">{data.stylists.find((s) => s.id === x.stylist_id)?.name}</span>
                  <span className="muted block">{formatDay(x.starts_at, tz)} {formatTime(x.starts_at, tz)} – {localDay(new Date(x.ends_at), tz) !== localDay(new Date(x.starts_at), tz) ? `${formatDay(x.ends_at, tz)} ` : ""}{formatTime(x.ends_at, tz)}{x.reason ? ` · ${x.reason}` : ""}</span>
                </span>
                <button type="button" className="text-sm font-semibold text-bad underline" onClick={() => remove(x.id)} data-remove-time-off>{t("common.remove")}</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted text-sm">{t("salon.noTimeOff")}</p>}
      </Card>
      {editing && <StylistEditor stylist={null} onClose={() => setEditing(null)} />}
      {adding && <TimeOffEditor onClose={() => setAdding(false)} />}
    </>
  );
}

/** One account waiting to join: link it to a stylist without a login, add it as a new stylist, or decline. */
function WaitingRow({ id, name, phone }: { id: string; name: string; phone: string | null }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const free = data.stylists.filter((s) => !s.removed_at && !s.profile_id).sort((a, b) => a.sort - b.sort);
  const [to, setTo] = useState("new");
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await f(); await reload(); toast(done); } catch (e) { toast(errorText(e), "error"); } finally { setBusy(false); }
  };
  const link = () => run(async () => {
    const stylist = to !== "new" ? to : await store.saveStylist({ name: name || t("salon.newStylist"), bio: null, active: true, sort: Math.max(0, ...data.stylists.map((x) => x.sort)) + 1 },
      [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, starts: "09:00", ends: "19:00" })));
    await store.linkProfile(stylist, id);
  }, t("salon.linked"));
  return (
    <li className="space-y-2 py-3" data-waiting-row={name}>
      <p className="text-sm"><span className="font-semibold">{name || "—"}</span>{phone && <span className="muted"> · {phone}</span>}</p>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`to-${id}`}>{t("salon.linkTo")}</label>
        <select id={`to-${id}`} className="input min-h-10 min-w-0 flex-1" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="new">{t("salon.addNew")}</option>
          {free.map((s) => <option key={s.id} value={s.id}>{t("salon.linkTo")} {s.name}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={link} data-approve>{t("salon.approve")}</button>
        <button type="button" className="btn btn-ghost btn-sm text-bad" disabled={busy} onClick={() => run(() => store.declineJoin(id), t("salon.declined"))} data-decline-join>{t("salon.declineJoin")}</button>
      </div>
    </li>
  );
}

/** "Mon, Tue, Wed…": the days a stylist works. */
export function weekSummary(id: string, hours: { stylist_id: string; weekday: number }[], t: (k: string) => string) {
  return DAYS.filter((d) => hours.some((h) => h.stylist_id === id && h.weekday === d)).map((d) => t(`salon.days.${d}`).slice(0, 3)).join(", ") || t("salon.off");
}

export function StylistEditor({ stylist, onClose }: { stylist: Stylist | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const [s, setS] = useState<StylistDraft>(() => stylist ?? { name: "", bio: "", active: true, sort: Math.max(0, ...data.stylists.map((x) => x.sort)) + 1 });
  const [hours, setHours] = useState<HoursDraft[]>(() => (stylist
    ? data.hours.filter((h) => h.stylist_id === stylist.id).map(({ weekday, starts, ends }) => ({ weekday, starts, ends }))
    : [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, starts: "09:00", ends: "19:00" }))));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const of = (d: number) => hours.map((h, i) => [h, i] as const).filter(([h]) => h.weekday === d).sort(([a], [b]) => a.starts.localeCompare(b.starts));
  const patch = (i: number, p: Partial<HoursDraft>) => setHours((l) => l.map((h, j) => (j === i ? { ...h, ...p } : h)));

  const save = async () => {
    if (!s.name.trim()) { setError(t("salon.name")); return; }
    const problem = hoursProblem(hours);
    if (problem) { setError(problem); return; }
    setSaving(true); setError(null);
    try { await store.saveStylist(s, hours); await reload(); toast(t("common.saved")); onClose(); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  };

  return (
    <Sheet title={stylist ? t("salon.editStylist") : t("salon.newStylist")} onClose={onClose}>
      <div className="space-y-3" data-stylist-editor>
        <div><label className="label" htmlFor="sy-name">{t("salon.name")}</label><input id="sy-name" className="input" maxLength={80} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="sy-bio">{t("salon.bio")}</label><input id="sy-bio" className="input" maxLength={300} value={s.bio ?? ""} onChange={(e) => setS({ ...s, bio: e.target.value })} /></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} />{t("salon.working")}</label>
        <fieldset>
          <div className="mb-1 flex items-center justify-between gap-2">
            <legend className="label mb-0">{t("salon.week")}</legend>
            {of(1).length > 0 && (
              <button type="button" className="text-xs text-brand underline" data-copy-monday
                onClick={() => setHours((l) => [...l.filter((h) => h.weekday === 1 || h.weekday === 0 || h.weekday === 6),
                  ...[2, 3, 4, 5].flatMap((d) => l.filter((h) => h.weekday === 1).map((h) => ({ ...h, weekday: d })))])}>{t("salon.copyMonday")}</button>
            )}
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {DAYS.map((d) => {
              const blocks = of(d);
              return (
                <li key={d} className="p-2.5" data-week-row={d}>
                  <div className="flex items-center gap-2">
                    <label className="flex min-h-10 flex-1 items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={blocks.length > 0} data-works={d}
                        onChange={(e) => setHours((l) => (e.target.checked ? [...l, { weekday: d, starts: "09:00", ends: "19:00" }] : l.filter((h) => h.weekday !== d)))} />
                      {t(`salon.days.${d}`)}
                    </label>
                    {!blocks.length && <span className="muted text-sm">{t("salon.off")}</span>}
                    {blocks.length === 1 && (
                      <button type="button" className="text-xs text-brand underline" data-add-break={d}
                        onClick={() => { const [b, i] = blocks[0]; patch(i, { ends: "13:00" }); setHours((l) => [...l, { weekday: d, starts: "14:00", ends: b.ends > "14:00" ? b.ends : "19:00" }]); }}>{t("salon.addBlock")}</button>
                    )}
                  </div>
                  {blocks.map(([b, i]) => (
                    <div key={i} className="mt-1.5 flex items-center gap-2 pl-7">
                      <input type="time" aria-label={`${t(`salon.days.${d}`)} ${t("salon.from")}`} className="input min-h-10 w-auto flex-1" step={1800} value={b.starts} onChange={(e) => patch(i, { starts: e.target.value })} />
                      <span className="muted text-sm">–</span>
                      <input type="time" aria-label={`${t(`salon.days.${d}`)} ${t("salon.to")}`} className="input min-h-10 w-auto flex-1" step={1800} value={b.ends} onChange={(e) => patch(i, { ends: e.target.value })} />
                      {blocks.length > 1 && <button type="button" className="grid size-10 place-items-center rounded-xl text-bad hover:bg-bad-soft" aria-label={t("common.remove")} onClick={() => setHours((l) => l.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </fieldset>
        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary w-full" disabled={saving} onClick={save} data-save-stylist>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </Sheet>
  );
}

export function TimeOffEditor({ onClose, stylistId }: { onClose: () => void; stylistId?: string }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const tz = data.salon.timezone;
  const [today] = useState(() => localDay(new Date(), tz));
  const [f, setF] = useState({ stylist: stylistId ?? data.stylists.find((s) => s.active)?.id ?? "", day: addDays(today, 1), allDay: true, from: "09:00", to: "13:00", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const starts = at(f.day, f.allDay ? "00:00" : f.from, tz), ends = f.allDay ? at(addDays(f.day, 1), "00:00", tz) : at(f.day, f.to, tz);
    setSaving(true); setError(null);
    try { await store.addTimeOff({ stylist_id: f.stylist, starts_at: starts.toISOString(), ends_at: ends.toISOString(), reason: f.reason }); await reload(); toast(t("common.saved")); onClose(); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  };
  return (
    <Sheet title={t("salon.addTimeOff")} onClose={onClose}>
      <div className="space-y-3" data-time-off-editor>
        <div><label className="label" htmlFor="to-st">{t("sheet.stylist")}</label>
          <select id="to-st" className="input" value={f.stylist} onChange={(e) => setF({ ...f, stylist: e.target.value })}>{data.stylists.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className="label" htmlFor="to-day">{t("book.day")}</label><input id="to-day" type="date" className="input" min={today} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} data-all-day />{t("salon.allDay")}</label>
        {!f.allDay && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="to-from">{t("salon.from")}</label><input id="to-from" type="time" step={1800} className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
            <div><label className="label" htmlFor="to-to">{t("salon.to")}</label><input id="to-to" type="time" step={1800} className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          </div>
        )}
        <div><label className="label" htmlFor="to-why">{t("salon.reason")}</label><input id="to-why" className="input" maxLength={200} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary w-full" disabled={saving || !f.stylist || !f.day} onClick={save} data-save-time-off>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </Sheet>
  );
}
