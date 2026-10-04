// Small building blocks shared by every screen.
import type { AppointmentStatus } from "@/lib/domain/types";
import { Icon, type IconName } from "./icons";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} /></span>
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-tight tabular-nums">{value}</div>
        <div className="muted text-xs leading-snug">{label}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status, label }: { status: AppointmentStatus; label: string }) {
  return <span className={`badge badge-${status}`} data-status={status}>{label}</span>;
}

export function Empty({ text, icon = "calendar", children }: { text: string; icon?: IconName; children?: React.ReactNode }) {
  return (
    <div className="muted flex flex-col items-center gap-2 py-6 text-center text-sm">
      <Icon name={icon} size={28} className="opacity-60" />
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Spinner() {
  return <span className="inline-block size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />;
}
