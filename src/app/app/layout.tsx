"use client";
import { AppProvider } from "@/lib/data/app-context";
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider fallback={<Loading />} failed={(m, retry) => <Failed message={m} retry={retry} />}>
      <ToastProvider><AppShell>{children}</AppShell><Tour /></ToastProvider>
    </AppProvider>
  );
}
