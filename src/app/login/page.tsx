"use client";
// Sign in: the demo picker, the customers' sign-in, or the staff website's two doors.
import Link from "next/link";
import { AuthPage, SignInForm, StaffDoors } from "@/components/auth-forms";
import { DemoLogin } from "@/components/demo-login";
import { useT } from "@/lib/i18n";
import { SITE } from "@/lib/supabase/config";

export default function Login() {
  const t = useT();
  if (SITE === "demo") return <DemoLogin />;
  if (SITE === "staff") return <AuthPage title={t("staff.title")} lead={t("staff.lead")}><StaffDoors /></AuthPage>;
  return (
    <AuthPage title={t("auth.title")} lead={t("auth.customerLead")}>
      <SignInForm footer={<p className="text-center text-sm"><Link href="/signup" className="text-brand underline" data-to-signup>{t("auth.needAccount")}</Link></p>} />
    </AuthPage>
  );
}
