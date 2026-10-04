"use client";
// Who is signed in and what they may see, for every screen under /app.
// Demo accounts use the DemoStore (this browser); real accounts use Supabase.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dataset } from "../domain/types";
import { supabaseConfigured } from "../supabase/config";
import { DemoStore, demoAccount, setDemoAccount } from "./demo-store";
import { errorText, type Store } from "./store";

type App = { store: Store; data: Dataset; reload: () => Promise<void>; signOut: () => Promise<void> };
const Ctx = createContext<App | null>(null);

async function pickStore(): Promise<Store | null> {
  const demo = demoAccount();
  if (demo) return new DemoStore(demo);
  if (!supabaseConfigured()) return null;
  const [{ supabase }, { SupabaseStore }] = await Promise.all([import("../supabase/client"), import("./supabase-store")]);
  const { data } = await supabase().auth.getSession();
  return data.session ? new SupabaseStore() : null;
}

type Boot = { kind: "ok"; store: Store; data: Dataset } | { kind: "signin" } | { kind: "error"; message: string };
async function boot(): Promise<Boot> {
  try {
    const store = await pickStore();
    if (!store) return { kind: "signin" };
    return { kind: "ok", store, data: await store.load() };
  } catch (e) {
    // A demo account that no longer exists (e.g. after a reset): back to the picker.
    if (demoAccount() && /no longer exists|Unknown account/.test(String(e))) { setDemoAccount(null); return { kind: "signin" }; }
    return { kind: "error", message: errorText(e) };
  }
}

export function AppProvider({ children, fallback, failed }: {
  children: React.ReactNode; fallback: React.ReactNode; failed: (message: string, retry: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    boot().then((r) => {
      if (!live) return;
      if (r.kind === "ok") { setStore(r.store); setData(r.data); }
      else if (r.kind === "error") setError(r.message);
      else router.replace("/login");
    });
    return () => { live = false; };
  }, [attempt, router]);

  const reload = useCallback(async () => { if (store) setData(await store.load()); }, [store]);
  const signOut = useCallback(async () => { await store?.signOut(); router.replace("/login"); }, [store, router]);

  if (error) return <>{failed(error, () => { setError(null); setAttempt((n) => n + 1); })}</>;
  if (!store || !data) return <>{fallback}</>;
  return <Ctx.Provider value={{ store, data, reload, signOut }}>{children}</Ctx.Provider>;
}

export function useApp(): App {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
