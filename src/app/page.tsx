"use client";
// The salon's front page, phone first: what it is, how booking works, popular
// styles with prices, and where to find it. "Book" leads to sign-in.
import Link from "next/link";
import { Icon, Logo } from "@/components/icons";
import { LanguageSwitch } from "@/components/language-switch";
import { StyleList } from "@/components/style-list";
import { Spinner } from "@/components/ui";
import { useCatalogue } from "@/lib/data/catalogue";
import { useT } from "@/lib/i18n";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function Home() {
  const t = useT();
  const c = useCatalogue();
  const steps = [["sparkle", "step1"], ["calendar", "step2"], ["check", "step3"]] as const;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        <span className="flex items-center gap-2 font-semibold"><Logo size={30} />{t("app.name")}</span>
        <div className="ml-auto flex items-center gap-1"><span className="hidden sm:block"><LanguageSwitch /></span>
          <Link href="/login" className="btn btn-ghost btn-sm">{t("nav.signIn")}</Link></div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-10">
        <section className="relative mt-2 overflow-hidden rounded-3xl bg-brand px-5 py-8 text-on-brand sm:px-8 sm:py-12" data-hero>
          <svg className="pointer-events-none absolute -right-12 -top-6 h-56 w-40 opacity-15" viewBox="0 0 40 120" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx={20 + (i % 2 ? 5 : -5)} cy={8 + i * 9.5} rx="9" ry="7" fill="currentColor" />)}
          </svg>
          <p className="text-sm opacity-85">{t("landing.eyebrow", { city: c?.salon.city ?? "Washington, DC area" })}</p>
          <h1 className="mt-2 max-w-md text-[1.9rem] font-semibold leading-tight sm:text-4xl">{t("landing.title")}</h1>
          <p className="mt-3 max-w-md opacity-90">{t("landing.lead")}</p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/login" className="btn bg-surface text-brand hover:bg-brand-soft" data-cta-book>{t("landing.book")}<Icon name="arrow" size={18} /></Link>
            <a href="#styles" className="btn border border-white/40 text-on-brand hover:bg-white/10">{t("landing.styles")}</a>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="how">
          <h2 id="how" className="text-lg font-semibold">{t("landing.howTitle")}</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {steps.map(([icon, k], i) => (
              <li key={k} className="card p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} /></span>
                <p className="mt-2.5 font-semibold">{i + 1}. {t(`landing.${k}`)}</p>
                <p className="muted mt-1 text-sm">{t(`landing.${k}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="styles" className="mt-8 scroll-mt-4" aria-labelledby="popular">
          <h2 id="popular" className="text-lg font-semibold">{t("landing.popular")}</h2>
          <p className="muted mt-1 text-sm">{t("styles.lead")}</p>
          <div className="mt-3">{c ? <StyleList styles={c.styles} options={c.options} currency={c.salon.currency} /> : <div className="grid h-32 place-items-center"><Spinner /></div>}</div>
        </section>

        <section className="card mt-8 p-4" aria-labelledby="visit">
          <h2 id="visit" className="text-lg font-semibold">{t("landing.visit")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {c?.salon.address && <li className="flex gap-2"><Icon name="pin" className="mt-0.5 shrink-0 text-brand" /><span>{c.salon.address}{c.salon.city && <span className="muted block">{c.salon.city}</span>}</span></li>}
            <li className="flex gap-2"><Icon name="clock" className="mt-0.5 shrink-0 text-brand" />{t("landing.hours")}</li>
            {c?.salon.phone && <li className="flex gap-2"><Icon name="phone" className="mt-0.5 shrink-0 text-brand" /><a className="underline" href={`tel:${c.salon.phone.replace(/\s/g, "")}`}>{c.salon.phone}</a></li>}
            <li className="flex gap-2"><Icon name="money" className="mt-0.5 shrink-0 text-brand" />{t("landing.pay")}</li>
          </ul>
          <Link href="/login" className="btn btn-primary mt-4 w-full sm:w-auto">{t("landing.book")}</Link>
        </section>
        {!supabaseConfigured() && <p className="muted mt-6 text-center text-xs">{t("landing.demoNote")}</p>}
      </main>
    </div>
  );
}
