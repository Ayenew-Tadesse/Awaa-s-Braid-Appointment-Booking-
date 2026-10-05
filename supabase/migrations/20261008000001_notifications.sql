-- Notifications (milestone 4): made by the database itself when an appointment
-- changes, so nothing can be skipped or faked from the app.
--   to the customer   confirmed, moved, declined, cancelled by the salon
--   to the salon      a new request, a customer cancelling
-- Each person reads (and marks as read) only their own. The words are chosen by
-- the app from `kind` and `data`, so they appear in the reader's language.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('booked', 'confirmed', 'moved', 'declined', 'cancelled_by_salon', 'cancelled_by_customer')),
  appointment_id uuid references public.appointments (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Only "read" can be changed, and only by its owner; nobody writes them from the app.
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function private.notify(p_user uuid, p_kind text, a public.appointments)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, appointment_id, data)
  values (p_user, p_kind, a.id, jsonb_build_object(
    'style', a.style_name, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'customer', (select full_name from public.profiles where id = a.customer_id),
    'stylist', (select name from public.stylists where id = a.stylist_id)))
$$;

create function private.notify_admins(p_kind text, a public.appointments)
returns void language sql security definer set search_path = '' as $$
  select private.notify(id, p_kind, a) from public.profiles where role = 'admin'
$$;

create function private.on_appointment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then perform private.notify_admins('booked', new); end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'pending' then perform private.notify(new.customer_id, 'confirmed', new);
    elsif new.status = 'cancelled' and new.cancelled_by = 'salon' then
      perform private.notify(new.customer_id, case when old.status = 'pending' then 'declined' else 'cancelled_by_salon' end, new);
    elsif new.status = 'cancelled' and new.cancelled_by = 'customer' then perform private.notify_admins('cancelled_by_customer', new);
    end if;
  elsif (new.starts_at, new.stylist_id) is distinct from (old.starts_at, old.stylist_id) and new.status in ('pending', 'confirmed') then
    perform private.notify(new.customer_id, 'moved', new);
  end if;
  return new;
end $$;
create trigger appointments_notify after insert or update on public.appointments
  for each row execute function private.on_appointment_change();
