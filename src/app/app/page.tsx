"use client";
import { AdminHome } from "@/components/home-admin";
import { CustomerHome } from "@/components/home-customer";
import { useApp } from "@/lib/data/app-context";

export default function AppHome() {
  const { data } = useApp();
  return data.me.role === "admin" ? <AdminHome /> : <CustomerHome />;
}
