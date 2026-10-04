"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Booking } from "@/components/booking";

function BookWithStyle() {
  // /app/book?style=<id> starts with that style chosen (from the styles list).
  const style = useSearchParams().get("style");
  return <Booking key={style ?? ""} initialStyle={style} />;
}

export default function Book() {
  return <Suspense><BookWithStyle /></Suspense>;
}
