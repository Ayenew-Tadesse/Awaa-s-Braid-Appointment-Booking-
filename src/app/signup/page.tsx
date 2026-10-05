"use client";
// Create an account: a customer on the customer website; on the staff website,
// a stylist asking to join the team. (The demo website has no sign-up.)
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthPage, SignUpForm } from "@/components/auth-forms";
import { useT } from "@/lib/i18n";
import { SITE } from "@/lib/supabase/config";

export default function SignUp() {
  const t = useT();
  const router = useRouter();
  useEffect(() => { if (SITE === "demo") router.replace("/login"); }, [router]);
  if (SITE === "demo") return null;
  return SITE === "staff"
    ? <AuthPage title={t("staff.joinTitle")} lead={t("staff.joinLead")} back="/login/stylist"><SignUpForm joinTeam signInHref="/login/stylist" /></AuthPage>
    : <AuthPage title={t("auth.create")} lead={t("auth.createLead")} back="/login"><SignUpForm joinTeam={false} signInHref="/login" /></AuthPage>;
}
