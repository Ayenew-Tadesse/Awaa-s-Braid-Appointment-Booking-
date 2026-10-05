"use client";
// The guided demo tour's overlay (stops in lib/demo/tour.ts). On each stop it
// becomes the right demo account (a reload), opens the page, dims everything
// but the thing it's about, and explains it in a small card with Back / Next /
// End tour. Demo accounts only; nothing here touches a real salon's data.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/data/app-context";
import { loadWorld, setDemoAccount } from "@/lib/data/demo-store";
import { TOUR, TOUR_ACCOUNTS, setTourStop, subscribeTour, tourStop } from "@/lib/demo/tour";
import { useT } from "@/lib/i18n";
import { Spinner } from "./ui";
import { useToast } from "./toast";

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;

export function Tour() {
  const t = useT();
  const { store, data } = useApp();
  const router = useRouter();
  const path = usePathname();
  const n = useSyncExternalStore(subscribeTour, tourStop, () => null);
  const stop = n === null ? null : TOUR[n];
  const [box, setBox] = useState<Box | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const toast = useToast();

  const wrongRole = !!stop && store.mode === "demo" && data.me.role !== stop.role;
  const wrongPage = !!stop && !wrongRole && path !== stop.path;

  // Become the stop's account (a fresh load of the app) or open its page.
  useEffect(() => {
    if (!stop || store.mode !== "demo") return;
    if (wrongRole) {
      const acc = loadWorld().accounts.find((a) => a.email === TOUR_ACCOUNTS[stop.role]);
      if (!acc) { setTourStop(null); return; }
      setDemoAccount(acc.profile_id);
      location.assign(stop.path);
    } else if (wrongPage) router.push(stop.path);
  }, [stop, wrongRole, wrongPage, store.mode, router]);

  // Find what the stop is about (pages draw a moment later) and follow it as the page moves.
  const measure = useCallback(() => {
    if (!stop) return;
    const el = document.querySelector<HTMLElement>(stop.target);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [stop]);
  useLayoutEffect(() => {
    if (!stop || wrongRole || wrongPage) return;
    let tries = 0, scrolled = false;
    const find = setInterval(() => {
      const el = document.querySelector<HTMLElement>(stop.target);
      if (el && !scrolled) { el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }); scrolled = true; }
      measure();
      if (el || ++tries > 30) clearInterval(find);
    }, 100);
    addEventListener("resize", measure);
    addEventListener("scroll", measure, true);
    return () => { clearInterval(find); removeEventListener("resize", measure); removeEventListener("scroll", measure, true); setBox(null); };
  }, [stop, wrongRole, wrongPage, measure]);
  useEffect(() => { if (stop && !wrongRole && !wrongPage) next.current?.focus(); }, [stop, wrongRole, wrongPage]);

  // Escape ends the tour (listening all along, so even the first moment of a stop counts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && tourStop() !== null) setTourStop(null); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  if (!stop || n === null || store.mode !== "demo") return null;
  if (wrongRole || wrongPage) {
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45" role="status" aria-live="polite">
        <div className="card flex items-center gap-3 px-5 py-4"><Spinner />{t("tour.switching", { role: t(`role.${stop.role}`) })}</div>
      </div>
    );
  }
  const last = n === TOUR.length - 1;
  // The card sits under the highlight when there's room, else above it, else in the corner
  // (a tall highlight); on phones it's a bottom sheet.
  const CARD = 230;
  const wide = innerWidth >= 640;
  const where = !box ? "corner" : innerHeight - (box.top + box.height) >= CARD + 12 ? "below" : box.top >= CARD + 12 ? "above" : "corner";
  const left = box ? Math.max(16, Math.min(box.left, innerWidth - 376)) : undefined;
  const cardStyle: React.CSSProperties = !wide ? {}
    : where === "below" ? { top: box!.top + box!.height + 12, left }
    : where === "above" ? { bottom: innerHeight - box!.top + 12, left }
    : { bottom: 16, right: 16 };
  return (
    <div className="fixed inset-0 z-[90]" data-tour-overlay>
      {box ? (
        <div className="pointer-events-none fixed rounded-2xl ring-2 ring-white transition-all duration-200"
          style={{ ...box, boxShadow: "0 0 0 9999px rgb(15 23 42 / 0.55)" }} data-tour-highlight />
      ) : <div className="pointer-events-none fixed inset-0 bg-black/55" />}
      <section role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body"
        className={`card fixed z-[91] w-auto p-4 shadow-xl sm:w-[360px] ${wide ? "" : "inset-x-3 bottom-3"}`} style={cardStyle}>
        <p className="text-xs font-semibold text-brand">{t("tour.step", { n: n + 1, total: TOUR.length })} · {t(`role.${stop.role}`)}</p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold">{t(`tour.${stop.key}.title`)}</h2>
        <p id="tour-body" className="muted mt-1 text-sm">{t(`tour.${stop.key}.body`)}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="text-sm text-muted underline" onClick={() => setTourStop(null)} data-tour-end>{t("tour.skip")}</button>
          <span className="flex-1" />
          <button type="button" className="btn btn-ghost btn-sm" disabled={n === 0} onClick={() => setTourStop(n - 1)} data-tour-back>{t("tour.back")}</button>
          <button type="button" ref={next} className="btn btn-primary btn-sm" data-tour-next
            onClick={() => { if (last) { setTourStop(null); toast(t("tour.done")); } else setTourStop(n + 1); }}>{last ? t("tour.finish") : t("tour.forward")}</button>
        </div>
      </section>
    </div>
  );
}
