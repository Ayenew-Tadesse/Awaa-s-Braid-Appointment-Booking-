"use client";
// Short confirmations and errors ("Attendance saved"), announced to screen readers.
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; text: string; tone: "ok" | "error" };
const Ctx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
let n = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = ++n;
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite" role="status">
        {list.map((x) => (
          <div key={x.id} className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${x.tone === "error" ? "bg-bad text-white" : "bg-text text-bg"}`}>{x.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
