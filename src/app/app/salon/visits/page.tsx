"use client";
// Home visits: the ZIP codes the stylists travel to (their first three digits)
// and the time kept free after each visit to get to the next home. The database
// checks both again (20261009000001_home_visits.sql).
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { Card, Empty, PageHeader } from "@/components/ui";
import { useApp } from "@/lib/data/app-context";
import { errorText } from "@/lib/data/store";
import { areaLabel } from "@/lib/domain/booking";
import { useT } from "@/lib/i18n";

export default function SalonVisits() {
  const t = useT();
  const toast = useToast();
  const { data, store, reload } = useApp();
  const [zips, setZips] = useState(() => data.salon.service_zips.join(", "));
  const [travel, setTravel] = useState(String(data.salon.travel_minutes));
  const [saving, setSaving] = useState(false);
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;

  const list = zips.split(/[\s,]+/).filter(Boolean);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await store.saveVisitSettings({ service_zips: list, travel_minutes: Number(travel) }); await reload(); toast(t("common.saved")); }
    catch (err) { toast(errorText(err), "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Link href="/app/salon" className="muted mb-2 inline-flex items-center gap-1 text-sm"><Icon name="chevron" size={16} className="rotate-180" />{t("salon.title")}</Link>
      <PageHeader title={t("salon.visits")} subtitle={t("salon.visitsLead")} />
      <form onSubmit={save} className="space-y-4" data-visits>
        <Card>
          <label htmlFor="zips" className="label">{t("salon.area")}</label>
          <input id="zips" className="input" inputMode="numeric" value={zips} onChange={(e) => setZips(e.target.value)} />
          <p className="muted mt-1.5 text-xs">{t("salon.areaHint")}</p>
          {list.length > 0 && list.every((z) => /^\d{3}$/.test(z)) && <p className="mt-2 text-sm" data-area-preview>{t("account.area", { area: areaLabel(list) })}</p>}
        </Card>
        <Card>
          <label htmlFor="travel" className="label">{t("salon.travel")}</label>
          <input id="travel" className="input max-w-32" type="number" min={0} max={240} step={15} value={travel} onChange={(e) => setTravel(e.target.value)} />
          <p className="muted mt-1.5 text-xs">{t("salon.travelHint")}</p>
        </Card>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={saving} data-save-visits>{saving ? t("common.saving") : t("common.save")}</button>
      </form>
    </>
  );
}
