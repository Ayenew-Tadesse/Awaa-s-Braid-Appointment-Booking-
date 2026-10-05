"use client";
// The frame around every signed-in screen: the salon's name at the top and the
// main sections as a tab bar at the bottom on phones (in the top bar on wider screens).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/data/app-context";
import { useT } from "@/lib/i18n";
import { Icon, Logo, type IconName } from "./icons";
import { Bell } from "./notifications";
import { OfflineBanner } from "./offline";

type Tab = { href: string; label: string; icon: IconName };

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const path = usePathname();
  const { data, store } = useApp();
  const admin = data.me.role === "admin";
  // Customers: Home, Book, Styles, Account. The salon: Today, Calendar, Salon (styles, team, reports), Account.
  const tabs: Tab[] = data.me.role === "stylist" ? [
    { href: "/app", label: t("nav.jobs"), icon: "home" },
    { href: "/app/week", label: t("nav.week"), icon: "clock" },
    { href: "/app/account", label: t("nav.account"), icon: "user" },
  ] : admin ? [
    { href: "/app", label: t("nav.today"), icon: "home" },
    { href: "/app/calendar", label: t("nav.calendar"), icon: "calendar" },
    { href: "/app/salon", label: t("nav.salon"), icon: "scissors" },
    { href: "/app/account", label: t("nav.account"), icon: "user" },
  ] : [
    { href: "/app", label: t("nav.home"), icon: "home" },
    { href: "/app/book", label: t("nav.book"), icon: "calendar" },
    { href: "/app/styles", label: t("nav.styles"), icon: "sparkle" },
    { href: "/app/account", label: t("nav.account"), icon: "user" },
  ];
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/app" className="flex items-center gap-2 font-semibold"><Logo size={30} />{data.salon.name}</Link>
          {store.mode === "demo" && <span className="badge bg-accent-soft text-accent" data-demo-badge>{t("common.demo")}</span>}
          <nav className="ml-auto hidden gap-1 sm:flex" aria-label={t("nav.main")}>
            {tabs.map((x) => (
              <Link key={x.href} href={x.href} aria-current={active(x.href) ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${active(x.href) ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-surface-2"}`}>
                <Icon name={x.icon} size={18} />{x.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto sm:ml-0"><Bell /></div>
        </div>
        <OfflineBanner />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label={t("nav.main")} data-tabbar>
        <ul className={`grid ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {tabs.map((x) => (
            <li key={x.href}>
              <Link href={x.href} aria-current={active(x.href) ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${active(x.href) ? "font-semibold text-brand" : "text-muted"}`}>
                <Icon name={x.icon} size={22} />{x.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
