"use client";
import { useParams } from "next/navigation";
import { StylistSchedule } from "@/components/stylist-schedule";

export default function StylistPage() {
  const { id } = useParams<{ id: string }>();
  return <StylistSchedule id={id} />;
}
