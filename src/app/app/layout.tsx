"use client";
import { AppProvider, useApp } from "@/lib/data/app-context";
import { siteVerdict } from "@/lib/domain/site";
import { SITE, STAFF_URL } from "@/lib/supabase/config";
import { Icon } from "@/components/icons";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui";
import { ToastProvider } from "@/components/toast";
import { Tour } from "@/components/tour";
import { useT } from "@/lib/i18n";

function Loading() {
  const t = useT();
  return <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite"><div className="flex items-center gap-3 text-muted"><Spinner />{t("common.loading")}</div></div>;
}
function Failed({ message, retry }: { message: string; retry: () => void }) {
  const t = useT();
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card max-w-sm p-6 text-center">
        <p className="font-semibold">{t("common.error")}</p>
        <p className="muted mt-1 text-sm">{message}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={retry}>{t("common.retry")}</button>
      </div>
    </div>
  );
}

/** Keeps each person on their own website: customers on the customer site, the salon and stylists on the staff site. */
function SiteGate({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { data, signOut } = useApp();
  const verdict = siteVerdict(SITE, data.me);
  if (verdict === "ok") return <>{children}</>;
  const phone = data.salon.phone?.replace(/[^\d+]/g, "");
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card max-w-sm p-6 text-center" data-site-gate={verdict}>
        <p className="font-semibold">{t(`gate.${verdict}.title`)}</p>
        <p className="muted mt-1 text-sm">{t(`gate.${verdict}.body`)}</p>
        <div className="mt-4 flex flex-col gap-2">
          {verdict === "use-staff-site" && STAFF_URL && <a className="btn btn-primary" href={`${STAFF_URL.replace(/\/$/, "")}/login`}>{t("gate.goStaff")}</a>}
          {verdict === "waiting" && phone && <a className="btn btn-ghost" href={`tel:${phone}`}><Icon name="phone" size={16} />{t("account.call")}</a>}
          <button type="button" className="btn btn-ghost" onClick={signOut} data-sign-out>{t("nav.signOut")}</button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider fallback={<Loading />} failed={(m, retry) => <Failed message={m} retry={retry} />}>
      <SiteGate><ToastProvider><AppShell>{children}</AppShell>{SITE === "demo" && <Tour />}</ToastProvider></SiteGate>
    </AppProvider>
  );
}
