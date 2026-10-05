"use client";
// Sign-in and sign-up for the real websites (Supabase). Which one shows where:
//   customer website   /login (customers), /signup (create an account)
//   staff website      /login (choose), /login/admin, /login/stylist, /signup (join the team)
// Anyone who signs up is a customer; joining the team is only a request the
// salon settles. After signing in, app/app/layout.tsx keeps each person on the
// right website (domain/site.ts).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setDemoAccount } from "@/lib/data/demo-store";
import { useT } from "@/lib/i18n";
import { Icon, Logo } from "./icons";
import { LanguageSwitch } from "./language-switch";

export function AuthPage({ title, lead, children, back }: { title: string; lead?: string; children: React.ReactNode; back?: string }) {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 font-semibold"><Logo size={30} />{t("app.name")}</Link>
        <LanguageSwitch />
      </div>
      <main id="main" className="flex-1 py-8">
        {back && <Link href={back} className="muted mb-3 inline-flex items-center gap-1 text-sm"><Icon name="chevron" size={16} className="rotate-180" />{t("common.back")}</Link>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {lead && <p className="muted mt-1 text-sm">{lead}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

const offline = (m: string) => /fetch|network/i.test(m);

export function SignInForm({ footer }: { footer?: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const { supabase } = await import("@/lib/supabase/client");
    const { error: err } = await supabase().auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password });
    if (err) { setBusy(false); setError(offline(err.message) ? t("auth.offline") : t("auth.wrong")); return; }
    setDemoAccount(null);
    router.push("/app");
  };
  return (
    <form onSubmit={submit} className="space-y-3" noValidate data-sign-in>
      <div>
        <label htmlFor="email" className="label">{t("auth.email")}</label>
        <input id="email" type="email" autoComplete="username" inputMode="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div>
        <label htmlFor="password" className="label">{t("auth.password")}</label>
        <input id="password" type="password" autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      </div>
      {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !form.email || !form.password}>{busy ? t("auth.signingIn") : t("auth.signIn")}</button>
      {footer}
    </form>
  );
}

export function SignUpForm({ joinTeam, signInHref }: { joinTeam: boolean; signInHref: string }) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) { setError(t("auth.weakPassword")); return; }
    setBusy(true);
    const { supabase } = await import("@/lib/supabase/client");
    const { data, error: err } = await supabase().auth.signUp({
      email: form.email.trim().toLowerCase(), password: form.password,
      options: { data: { full_name: form.name.trim(), phone: form.phone.trim(), ...(joinTeam ? { join_team: "true" } : {}) } },
    });
    setBusy(false);
    if (err) { setError(offline(err.message) ? t("auth.offline") : err.message); return; }
    if (data.session) { setDemoAccount(null); router.push("/app"); return; }
    setDone(true);
  };
  if (done) return (
    <div className="space-y-4" data-signed-up>
      <p className="rounded-xl bg-good-soft px-3 py-2 text-sm text-good" role="status">{t(joinTeam ? "auth.joinCreated" : "auth.created")}</p>
      <Link href={signInHref} className="btn btn-primary w-full">{t("auth.signIn")}</Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-3" noValidate data-sign-up>
      <div>
        <label htmlFor="name" className="label">{t("auth.fullName")}</label>
        <input id="name" autoComplete="name" className="input" value={form.name} onChange={set("name")} maxLength={120} required />
      </div>
      <div>
        <label htmlFor="phone" className="label">{t("auth.phone")}</label>
        <input id="phone" type="tel" autoComplete="tel" inputMode="tel" className="input" value={form.phone} onChange={set("phone")} maxLength={30} placeholder="(202) 555-0123" />
      </div>
      <div>
        <label htmlFor="email" className="label">{t("auth.email")}</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" className="input" value={form.email} onChange={set("email")} required />
      </div>
      <div>
        <label htmlFor="password" className="label">{t("auth.password")}</label>
        <input id="password" type="password" autoComplete="new-password" className="input" value={form.password} onChange={set("password")} required />
        <p className="muted mt-1 text-xs">{t("auth.weakPassword")}</p>
      </div>
      {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !form.email || !form.password || !form.name.trim()}>
        {busy ? t("auth.creating") : t(joinTeam ? "auth.joinSend" : "auth.create")}
      </button>
      <p className="text-center text-sm"><Link href={signInHref} className="text-brand underline">{t("auth.haveAccount")}</Link></p>
    </form>
  );
}

/** The staff website's front door: the salon admin, or a stylist. */
export function StaffDoors() {
  const t = useT();
  const doors: [string, "scissors" | "pin", string, string][] = [
    ["/login/admin", "scissors", t("staff.admin"), t("staff.adminHint")],
    ["/login/stylist", "pin", t("staff.stylist"), t("staff.stylistHint")],
  ];
  return (
    <ul className="grid gap-2.5" data-staff-doors>
      {doors.map(([href, icon, title, hint]) => (
        <li key={href}>
          <Link href={href} className="card flex items-center gap-3 p-4 hover:border-brand" data-door={href}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="muted block text-sm">{hint}</span></span>
            <Icon name="chevron" className="text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
