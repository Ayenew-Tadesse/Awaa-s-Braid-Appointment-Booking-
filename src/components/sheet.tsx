"use client";
// A panel that slides up from the bottom on phones (a centred dialog on wider
// screens), for details and actions. Escape, the backdrop or ✕ closes it.
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { trapTab } from "./focus-trap";
import { Icon } from "./icons";

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: React.ReactNode; label?: string }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else trapTab(e, box.current); };
    addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.documentElement.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[75] grid items-end bg-black/45 sm:place-items-center" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label ?? title} data-sheet
        className="card max-h-[88dvh] w-full overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] outline-none sm:max-w-lg sm:rounded-b-[var(--radius)]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label={t("common.close")}><Icon name="x" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
