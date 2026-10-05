// The day-before reminder: worked out in the app from your own appointments
// (no message is sent anywhere). An open appointment starting in the next 24 hours.
import { isOpen, type Appointment } from "./types";

export function reminders(appointments: Appointment[], customerId: string, now: Date): Appointment[] {
  const t = now.getTime();
  return appointments
    .filter((a) => a.customer_id === customerId && isOpen(a) && Date.parse(a.starts_at) > t && Date.parse(a.starts_at) <= t + 86400000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
