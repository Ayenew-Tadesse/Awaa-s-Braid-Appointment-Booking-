"use client";
// The demo website's sign-in (no Supabase): the fictional salon's customer,
// stylist and admin accounts, the tour, and resetting the demo. Nothing here
// reaches a real salon. The real websites use auth-forms.tsx.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, Logo, type IconName } from "@/components/icons";
import { LanguageSwitch } from "@/components/language-switch";
import { Spinner } from "@/components/ui";
import { loadWorld, resetDemo, setDemoAccount } from "@/lib/data/demo-store";
import { DEMO_PASSWORD } from "@/lib/demo/seed";
import { useT } from "@/lib/i18n";
import { supabaseConfigured } from "@/lib/supabase/config";
import { TOUR_ACCOUNTS, setTourStop } from "@/lib/demo/tour";

const DEMO: { email: string; role: "customer" | "admin" | "stylist"; icon: IconName }[] = [
  { email: "customer@example.com", role: "customer", icon: "user" },
  { email: "stylist@example.com", role: "stylist", icon: "pin" },
  { email: "admin@example.com", role: "admin", icon: "scissors" },
];

export function DemoLogin() {
  const t = useT();
  const router = useRouter();
  const real = supabaseConfigured();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const enterDemo = (addr: string) => {
    setBusy(addr);
    const acc = loadWorld().accounts.find((a) => a.email === addr);
    if (!acc) { setBusy(null); setError(t("auth.wrong")); return; }
    setDemoAccount(acc.profile_id);
    router.push("/app");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNote(null);
    const email = form.email.trim().toLowerCase();
    const demo = loadWorld().accounts.find((a) => a.email === email);
    if (mode === "in" && demo && form.password === DEMO_PASSWORD) return enterDemo(email);
    if (!real) { setError(demo ? t("auth.wrong") : t("auth.demoOnly")); return; }
    if (mode === "up" && form.password.length < 8) { setError(t("auth.weakPassword")); return; }
    setBusy("form");
    const { supabase } = await import("@/lib/supabase/client");
    const sb = supabase();
    const offline = (m: string) => /fetch|network/i.test(m);
    if (mode === "in") {
      const { error: err } = await sb.auth.signInWithPassword({ email, password: form.password });
      if (err) { setBusy(null); setError(offline(err.message) ? t("auth.offline") : t("auth.wrong")); return; }
      setDemoAccount(null);
      router.push("/app");
      return;
    }
    const { data, error: err } = await sb.auth.signUp({
      email, password: form.password,
      options: { data: { full_name: form.name.trim(), phone: form.phone.trim() } },
    });
    setBusy(null);
    if (err) { setError(offline(err.message) ? t("auth.offline") : err.message); return; }
    if (data.session) { setDemoAccount(null); router.push("/app"); return; }
    setMode("in"); setNote(t("auth.created"));
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 font-semibold"><Logo size={30} />{t("app.name")}</Link>
        <LanguageSwitch />
      </div>

      <main id="main" className="flex-1 py-8">
        <h1 className="text-2xl font-semibold">{t("auth.demoTitle")}</h1>
        <p className="muted mt-1 text-sm">{t("auth.demoHint")}</p>
        <button type="button" className="btn btn-primary mt-4 w-full" disabled={!!busy} data-tour-start
          onClick={() => { setTourStop(0); enterDemo(TOUR_ACCOUNTS.customer); }}>
          <Icon name="sparkle" size={18} />{t("tour.start")}
        </button>
        <ul className="mt-3 grid gap-2.5">
          {DEMO.map((d) => (
            <li key={d.email}>
              <button type="button" onClick={() => enterDemo(d.email)} disabled={!!busy} data-demo={d.role}
                className="card flex w-full items-center gap-3 p-3.5 text-left transition hover:border-brand disabled:opacity-60">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{busy === d.email ? <Spinner /> : <Icon name={d.icon} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t("auth.demoAs", { role: t(`role.${d.role}`) })}</span>
                  <span className="muted block truncate text-xs">{d.email}</span>
                </span>
                <Icon name="arrow" size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>

        <div className="my-7 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />{t("auth.orSignIn")}<span className="h-px flex-1 bg-line" /></div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          {mode === "up" && (
            <>
              <div>
                <label htmlFor="name" className="label">{t("auth.fullName")}</label>
                <input id="name" autoComplete="name" className="input" value={form.name} onChange={set("name")} maxLength={120} required />
              </div>
              <div>
                <label htmlFor="phone" className="label">{t("auth.phone")}</label>
                <input id="phone" type="tel" autoComplete="tel" inputMode="tel" className="input" value={form.phone} onChange={set("phone")} maxLength={30} placeholder="09…" />
              </div>
            </>
          )}
          <div>
            <label htmlFor="email" className="label">{t("auth.email")}</label>
            <input id="email" type="email" autoComplete="username" inputMode="email" className="input" value={form.email} onChange={set("email")} required />
          </div>
          <div>
            <label htmlFor="password" className="label">{t("auth.password")}</label>
            <input id="password" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} className="input" value={form.password} onChange={set("password")} required />
          </div>
          {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
          {note && <p className="rounded-xl bg-good-soft px-3 py-2 text-sm text-good" role="status">{note}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={!!busy || !form.email || !form.password || (mode === "up" && !form.name.trim())}>
            {busy === "form" ? (mode === "up" ? t("auth.creating") : t("auth.signingIn")) : mode === "up" ? t("auth.create") : t("auth.signIn")}
          </button>
          {real ? (
            <button type="button" className="w-full text-center text-sm text-brand underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setNote(null); }} data-switch-mode>
              {mode === "in" ? t("auth.needAccount") : t("auth.haveAccount")}
            </button>
          ) : (
            <p className="muted text-center text-xs">{t("auth.demoPasswordHint", { password: DEMO_PASSWORD })}</p>
          )}
        </form>
        <p className="mt-8 text-center">
          <button type="button" className="text-xs text-muted underline" onClick={() => { resetDemo(); setDemoAccount(null); setError(null); setNote(t("auth.resetDone")); }}>{t("auth.resetDemo")}</button>
        </p>
      </main>
    </div>
  );
}
