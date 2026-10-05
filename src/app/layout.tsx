import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import { SkipLink } from "@/components/skip-link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Awaa Braids · Book your braids", template: "%s · Awaa Braids" },
  description: "Book braiding appointments from your phone: pick a style, choose a free time, and the salon confirms it.",
  // The staff website is for the salon only: search engines are asked not to list it.
  ...(process.env.NEXT_PUBLIC_SITE === "staff" && process.env.NEXT_PUBLIC_SUPABASE_URL ? { robots: { index: false, follow: false } } : {}),
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#6d2e5b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className="h-full antialiased">
      <body className="min-h-full">
        <I18nProvider><SkipLink />{children}</I18nProvider>
      </body>
    </html>
  );
}
