-- The team, managed by the salon (admins) only.
--   remove_stylist: takes a stylist off the team once nothing is upcoming for
--   them. Past appointments keep pointing at them (history and reports stay
--   right), so they are marked removed rather than deleted: no hours, no
--   future time off, never offered for booking again.
--   Customers still see the name of a stylist who did their own appointments.

alter table public.stylists add column removed_at timestamptz;

-- Did this stylist do one of my appointments? (Runs as the owner, so visitors,
-- who can't read appointments at all, simply get "no".)
create function private.served_me(p_stylist uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.appointments a where a.stylist_id = p_stylist and a.customer_id = auth.uid())
$$;
grant execute on function private.served_me(uuid) to anon, authenticated;

drop policy stylists_read on public.stylists;
create policy stylists_read on public.stylists for select to anon, authenticated using (
  (active and removed_at is null)
  or private.is_admin()
  or private.served_me(id)
);

create function public.remove_stylist(p_stylist uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the salon can remove stylists.' using errcode = '42501'; end if;
  if exists (select 1 from public.appointments where stylist_id = p_stylist and status in ('pending', 'confirmed') and ends_at > now()) then
    raise exception 'Move their upcoming appointments to another stylist first.';
  end if;
  delete from public.working_hours where stylist_id = p_stylist;
  delete from public.time_off where stylist_id = p_stylist and ends_at > now();
  update public.stylists set active = false, removed_at = now() where id = p_stylist and removed_at is null;
end $$;

revoke all on function public.remove_stylist(uuid) from public, anon;
grant execute on function public.remove_stylist(uuid) to authenticated;

-- A removed stylist can't be switched back on by accident (add them again instead).
create function private.guard_stylist() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.removed_at is not null and new.active then
    raise exception 'This stylist was removed. Add them again as a new stylist.';
  end if;
  return new;
end $$;
create trigger stylists_guard before update on public.stylists
  for each row execute function private.guard_stylist();
