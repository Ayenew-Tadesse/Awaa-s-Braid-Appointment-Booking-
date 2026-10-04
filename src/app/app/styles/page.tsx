"use client";
import { StyleList } from "@/components/style-list";
import { PageHeader } from "@/components/ui";
import { useApp } from "@/lib/data/app-context";
import { useT } from "@/lib/i18n";

export default function Styles() {
  const t = useT();
  const { data } = useApp();
  return (
    <>
      <PageHeader title={t("styles.title")} subtitle={t("styles.lead")} />
      <StyleList styles={data.styles} options={data.options} currency={data.salon.currency} />
    </>
  );
}
