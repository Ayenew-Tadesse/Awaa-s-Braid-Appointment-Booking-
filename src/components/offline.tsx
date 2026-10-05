"use client";
// A calm banner while the phone has no connection (nothing is lost; saving waits).
import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";

const subscribe = (f: () => void) => { addEventListener("online", f); addEventListener("offline", f); return () => { removeEventListener("online", f); removeEventListener("offline", f); }; };

export function OfflineBanner() {
  const t = useT();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div className="flex items-center gap-2 bg-warn-soft px-4 py-2 text-sm text-warn" role="status" data-offline>
      <Icon name="wifiOff" size={18} className="shrink-0" />{t("offline")}
    </div>
  );
}
