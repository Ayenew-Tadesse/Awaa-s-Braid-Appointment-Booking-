"use client";
import { Icon } from "@/components/icons";
import { LanguageSwitch } from "@/components/language-switch";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { useApp } from "@/lib/data/app-context";
import { useT } from "@/lib/i18n";
import { areaLabel } from "@/lib/domain/booking";

export default function Account() {
  const t = useT();
  const { data, store, signOut } = useApp();
  const s = data.salon;
  return (
    <>
      <PageHeader title={t("account.title")} />
      <div className="space-y-4">
        <Card>
          <p className="muted text-xs">{t("account.signedInAs")}</p>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={data.me.full_name} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold" data-me>{data.me.full_name}</p>
              <p className="muted text-sm">{t(`role.${data.me.role}`)}{data.me.phone ? ` · ${data.me.phone}` : ""}</p>
            </div>
          </div>
          {store.mode === "demo" && <p className="muted mt-3 text-sm">{t("account.demoNote")}</p>}
        </Card>
        {data.me.role === "customer" && (
          <Card title={t("account.home")}>
            {data.me.address
              ? <p className="text-sm" data-home>{data.me.address}<br />{[data.me.city, data.me.zip].filter(Boolean).join(" ")}</p>
              : <p className="muted text-sm">{t("account.noHome")}</p>}
            <p className="muted mt-2 text-xs">{t("account.homeHint")}</p>
          </Card>
        )}
        <Card title={t("account.salon")}>
          <p className="font-semibold">{s.name}</p>
          <p className="muted text-sm">{t("account.area", { area: areaLabel(s.service_zips) })}</p>
          {s.city && <p className="muted text-sm">{s.city}</p>}
          {s.phone && <a className="btn btn-ghost btn-sm mt-3" href={`tel:${s.phone.replace(/\s/g, "")}`}><Icon name="phone" size={16} />{t("account.call")}</a>}
        </Card>
        <Card title="Language / ቋንቋ"><LanguageSwitch /></Card>
        <button type="button" className="btn btn-ghost w-full" onClick={signOut} data-sign-out><Icon name="out" size={18} />{t("nav.signOut")}</button>
      </div>
    </>
  );
}
