"use client";
// The salon's settings and numbers, one tap away on a phone.
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Empty, PageHeader } from "@/components/ui";
import { useApp } from "@/lib/data/app-context";
import { useT } from "@/lib/i18n";

export default function Salon() {
  const t = useT();
  const { data } = useApp();
  if (data.me.role !== "admin") return <Empty text={t("common.adminOnly")} />;
  const items: [string, IconName, string, string][] = [
    ["/app/salon/styles", "sparkle", t("salon.styles"), t("salon.stylesHint")],
    ["/app/salon/team", "users", t("salon.team"), t("salon.teamHint")],
    ["/app/salon/visits", "pin", t("salon.visits"), t("salon.visitsHint")],
    ["/app/salon/reports", "chart", t("salon.reports"), t("salon.reportsHint")],
  ];
  return (
    <>
      <PageHeader title={t("salon.title")} subtitle={t("salon.lead")} />
      <ul className="space-y-2.5">
        {items.map(([href, icon, title, hint]) => (
          <li key={href}>
            <Link href={href} className="card flex items-center gap-3 p-4 hover:border-brand" data-salon-link={href}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="muted block text-sm">{hint}</span></span>
              <Icon name="chevron" className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
