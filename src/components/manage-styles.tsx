"use client";
// The salon's styles: every style (hidden ones too) with its starting price and
// time; add or edit one with its sizes, lengths and extras. Customers see the
// change straight away; booked appointments keep the price they were booked at.
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/data/app-context";
import { errorText, type OptionDraft, type StyleDraft } from "@/lib/data/store";
import { styleProblem } from "@/lib/domain/salon";
import { formatDuration, formatMoney } from "@/lib/domain/time";
import type { OptionKind, Style, StyleCategory } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { Sheet } from "./sheet";
import { StyleArt } from "./style-art";
import { useToast } from "./toast";
import { Empty, PageHeader } from "./ui";

const CATEGORIES: StyleCategory[] = ["braids", "cornrows", "twists", "locs", "kids", "other"];
const KINDS: OptionKind[] = ["size", "length", "extra"];

export function ManageStyles() {
  const t = useT();
  const { data } = useApp();
  const [editing, setEditing] = useState<Style | "new" | null>(null);
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;
  const styles = [...data.styles].sort((a, b) => a.sort - b.sort);
  return (
    <>
      <Link href="/app/salon" className="muted mb-2 inline-flex items-center gap-1 text-sm"><Icon name="chevron" size={16} className="rotate-180" />{t("salon.title")}</Link>
      <PageHeader title={t("salon.styles")} action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")} data-add-style><Icon name="plus" size={16} />{t("salon.addStyle")}</button>} />
      <ul className="space-y-2.5">
        {styles.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => setEditing(s)} className="card flex w-full overflow-hidden text-left hover:border-brand" data-manage-style={s.name}>
              <StyleArt category={s.category} className="h-auto w-16 shrink-0" />
              <span className="min-w-0 flex-1 p-3">
                <span className="flex items-center gap-2"><span className="font-semibold">{s.name}</span>{!s.active && <span className="badge badge-cancelled">{t("salon.hidden")}</span>}</span>
                <span className="muted block text-sm">{formatMoney(s.price, data.salon.currency)} · {formatDuration(s.duration_minutes)} · {data.options.filter((o) => o.style_id === s.id).length} {t("salon.options").toLowerCase()}</span>
              </span>
              <Icon name="chevron" className="m-3 self-center text-muted" />
            </button>
          </li>
        ))}
      </ul>
      {editing && <StyleEditor style={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function StyleEditor({ style, onClose }: { style: Style | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const [s, setS] = useState<StyleDraft>(() => style ?? {
    name: "", description: "", category: "braids", image_url: null, duration_minutes: 120, price: 100, active: true,
    sort: Math.max(0, ...data.styles.map((x) => x.sort)) + 1,
  });
  const [opts, setOpts] = useState<OptionDraft[]>(() => (style ? data.options.filter((o) => o.style_id === style.id).sort((a, b) => a.sort - b.sort)
    .map(({ kind, label, extra_minutes, extra_price }) => ({ kind, label, extra_minutes, extra_price })) : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof StyleDraft>(k: K, v: StyleDraft[K]) => setS((x) => ({ ...x, [k]: v }));
  const setOpt = (i: number, patch: Partial<OptionDraft>) => setOpts((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

  const save = async () => {
    const problem = styleProblem(s);
    if (problem) { setError(problem); return; }
    setSaving(true); setError(null);
    try { await store.saveStyle(s, opts); await reload(); toast(t("common.saved")); onClose(); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  };

  return (
    <Sheet title={style ? t("salon.editStyle") : t("salon.newStyle")} onClose={onClose}>
      <div className="space-y-3" data-style-editor>
        <div><label className="label" htmlFor="st-name">{t("salon.name")}</label><input id="st-name" className="input" maxLength={80} value={s.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label" htmlFor="st-desc">{t("salon.description")}</label><textarea id="st-desc" className="input min-h-20" maxLength={600} value={s.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="label" htmlFor="st-cat">{t("salon.category")}</label>
            <select id="st-cat" className="input" value={s.category} onChange={(e) => set("category", e.target.value as StyleCategory)}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`salon.categories.${c}`)}</option>)}</select></div>
          <div><label className="label" htmlFor="st-min">{t("salon.minutes")}</label><input id="st-min" className="input" inputMode="numeric" type="number" min={15} max={720} step={15} value={Number.isNaN(s.duration_minutes) ? "" : s.duration_minutes} onChange={(e) => set("duration_minutes", num(e.target.value))} /></div>
          <div><label className="label" htmlFor="st-price">{t("salon.price")}</label><input id="st-price" className="input" inputMode="decimal" type="number" min={0} step={5} value={Number.isNaN(s.price) ? "" : s.price} onChange={(e) => set("price", num(e.target.value))} /></div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={s.active} onChange={(e) => set("active", e.target.checked)} data-style-active />{t("salon.active")}</label>

        <fieldset>
          <legend className="label">{t("salon.options")}</legend>
          <div className="space-y-2">
            {opts.map((o, i) => (
              <div key={i} className="grid grid-cols-[5.5rem_1fr_auto] gap-2 rounded-2xl border border-line p-2" data-option-row>
                <select aria-label={t("salon.optionKind")} className="input" value={o.kind} onChange={(e) => setOpt(i, { kind: e.target.value as OptionKind })}>{KINDS.map((k) => <option key={k} value={k}>{t(`salon.kinds.${k}`)}</option>)}</select>
                <input aria-label={t("salon.optionLabel")} className="input" maxLength={60} value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} placeholder={t("salon.optionLabel")} />
                <button type="button" onClick={() => setOpts((l) => l.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-xl text-bad hover:bg-bad-soft" aria-label={t("common.remove")}><Icon name="x" size={18} /></button>
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted">{t("salon.plusMinutes")}
                    <input className="input mt-0.5" type="number" step={15} value={o.extra_minutes} onChange={(e) => setOpt(i, { extra_minutes: Number(e.target.value) || 0 })} /></label>
                  <label className="text-xs text-muted">{t("salon.plusPrice")}
                    <input className="input mt-0.5" type="number" step={5} value={o.extra_price} onChange={(e) => setOpt(i, { extra_price: Number(e.target.value) || 0 })} /></label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setOpts((l) => [...l, { kind: "size", label: "", extra_minutes: 0, extra_price: 0 }])} data-add-option><Icon name="plus" size={16} />{t("salon.addOption")}</button>
        </fieldset>

        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary w-full" disabled={saving} onClick={save} data-save-style>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </Sheet>
  );
}
