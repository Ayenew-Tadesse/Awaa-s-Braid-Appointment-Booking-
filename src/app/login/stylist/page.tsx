"use client";
// Staff website: a stylist signs in, or asks to join the team.
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthPage, SignInForm } from "@/components/auth-forms";
import { useT } from "@/lib/i18n";
import { SITE } from "@/lib/supabase/config";

export default function StylistLogin() {
  const t = useT();
  const router = useRouter();
  useEffect(() => { if (SITE !== "staff") router.replace("/login"); }, [router]);
  if (SITE !== "staff") return null;
  return (
    <AuthPage title={t("staff.stylist")} lead={t("staff.stylistLead")} back="/login">
      <SignInForm footer={<p className="text-center text-sm"><Link href="/signup" className="text-brand underline" data-to-signup>{t("staff.join")}</Link></p>} />
    </AuthPage>
  );
}
