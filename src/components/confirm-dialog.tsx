"use client";
// A small "are you sure?" sheet: from the bottom on phones, centred on wider screens.
// Escape or the backdrop keeps things as they are.
import { useEffect, useRef } from "react";

export function ConfirmDialog({ title, body, confirm, keep, busy, onConfirm, onClose }: {
  title: string; body: string; confirm: string; keep: string; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const keepBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] grid items-end bg-black/45 sm:place-items-center" onClick={onClose}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body"
        className="card w-full rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-b-[var(--radius)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <p id="confirm-body" className="muted mt-1 text-sm">{body}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={keepBtn} type="button" className="btn btn-ghost" onClick={onClose}>{keep}</button>
          <button type="button" className="btn bg-bad text-white hover:opacity-90" disabled={busy} onClick={onConfirm} data-confirm-cancel>{confirm}</button>
        </div>
      </div>
    </div>
  );
}
