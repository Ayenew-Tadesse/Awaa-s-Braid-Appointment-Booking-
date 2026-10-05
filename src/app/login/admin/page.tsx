"use client";
// Staff website: the salon admin signs in (there is no admin sign-up; the owner makes admins in Supabase).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthPage, SignInForm } from "@/components/auth-forms";
import { useT } from "@/lib/i18n";
import { SITE } from "@/lib/supabase/config";

export default function AdminLogin() {
  const t = useT();
  const router = useRouter();
  useEffect(() => { if (SITE !== "staff") router.replace("/login"); }, [router]);
  if (SITE !== "staff") return null;
  return <AuthPage title={t("staff.admin")} lead={t("staff.adminLead")} back="/login"><SignInForm /></AuthPage>;
}
