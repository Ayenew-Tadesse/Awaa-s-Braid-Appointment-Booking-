-- Stylist logins. A stylist signs up like anyone (always a customer at first);
-- the salon (an admin) then links that account to a stylist, which makes it a
-- stylist account. Only admins link and unlink.
--   a stylist sees    their own jobs (the appointments assigned to them), the
--                     name, phone and address of those customers only, their
--                     own working week and time off
--   a stylist can     mark their own confirmed job done or missed once it has started
--   a stylist hears   a job assigned to them, moved, or taken away / cancelled
-- Everything else (booking rules, confirming, moving, hours, the team) stays with the salon.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'admin', 'stylist'));

alter table public.stylists add column profile_id uuid unique references public.profiles (id) on delete set null;

-- The stylist the signed-in person is (null for everyone else).
create function private.my_stylist() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.stylists s join public.profiles p on p.id = s.profile_id
   where s.profile_id = auth.uid() and p.role = 'stylist' and s.removed_at is null
$$;
-- Is this person a customer on one of my jobs?
create function private.my_customer(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.appointments a where a.customer_id = p_profile and a.stylist_id = private.my_stylist())
$$;
grant execute on function private.my_stylist() to anon, authenticated;
grant execute on function private.my_customer(uuid) to anon, authenticated;

drop policy appointments_read on public.appointments;
create policy appointments_read on public.appointments for select to authenticated
  using (customer_id = auth.uid() or private.is_admin() or stylist_id = private.my_stylist());

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin() or private.my_customer(id));

create policy time_off_stylist on public.time_off for select to authenticated using (stylist_id = private.my_stylist());

drop policy stylists_read on public.stylists;
create policy stylists_read on public.stylists for select to anon, authenticated using (
  (active and removed_at is null) or private.is_admin() or private.served_me(id) or profile_id = auth.uid()
);

/* ------------------------------------------------- linking (admins only) */

create function public.link_stylist_login(p_stylist uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare who uuid; r text;
begin
  if not private.is_admin() then raise exception 'Only the salon can link stylist logins.' using errcode = '42501'; end if;
  if not exists (select 1 from public.stylists where id = p_stylist and removed_at is null) then raise exception 'Stylist not found.'; end if;
  select u.id into who from auth.users u where lower(u.email) = lower(trim(p_email));
  if who is null then raise exception 'No account uses that email yet. Ask the stylist to sign up first.'; end if;
  select role into r from public.profiles where id = who;
  if r = 'admin' then raise exception 'That is an admin account.'; end if;
  if exists (select 1 from public.stylists where profile_id = who and id <> p_stylist) then
    raise exception 'That account is already linked to another stylist.';
  end if;
  -- A login this stylist had before goes back to being a customer.
  update public.profiles set role = 'customer'
   where id = (select profile_id from public.stylists where id = p_stylist) and id <> who;
  update public.stylists set profile_id = who where id = p_stylist;
  update public.profiles set role = 'stylist' where id = who;
end $$;

create function public.unlink_stylist_login(p_stylist uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the salon can unlink stylist logins.' using errcode = '42501'; end if;
  update public.profiles set role = 'customer' where id = (select profile_id from public.stylists where id = p_stylist) and role = 'stylist';
  update public.stylists set profile_id = null where id = p_stylist;
end $$;

-- Removing a stylist also ends their login.
create or replace function public.remove_stylist(p_stylist uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the salon can remove stylists.' using errcode = '42501'; end if;
  if exists (select 1 from public.appointments where stylist_id = p_stylist and status in ('pending', 'confirmed') and ends_at > now()) then
    raise exception 'Move their upcoming appointments to another stylist first.';
  end if;
  perform public.unlink_stylist_login(p_stylist);
  delete from public.working_hours where stylist_id = p_stylist;
  delete from public.time_off where stylist_id = p_stylist and ends_at > now();
  update public.stylists set active = false, removed_at = now() where id = p_stylist and removed_at is null;
end $$;

/* ------------------------------------------------- a stylist's own jobs */

create function public.mark_job(p_id uuid, p_status text)
returns public.appointments language plpgsql security definer set search_path = '' as $$
declare a public.appointments; result public.appointments;
begin
  select * into a from public.appointments where id = p_id and stylist_id = private.my_stylist();
  if a.id is null then raise exception 'Job not found.' using errcode = '42501'; end if;
  if p_status not in ('completed', 'no_show') then raise exception 'Stylists mark jobs done or missed.'; end if;
  if a.status <> 'confirmed' then raise exception 'Only a confirmed job can be marked.'; end if;
  update public.appointments set status = p_status where id = a.id returning * into result; -- the status guard checks it has started
  return result;
end $$;

revoke all on function public.link_stylist_login(uuid, text) from public, anon;
revoke all on function public.unlink_stylist_login(uuid) from public, anon;
revoke all on function public.mark_job(uuid, text) from public, anon;
grant execute on function public.link_stylist_login(uuid, text) to authenticated;
grant execute on function public.unlink_stylist_login(uuid) to authenticated;
grant execute on function public.mark_job(uuid, text) to authenticated;

/* ------------------------------------------------- notifications for stylists */

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'booked', 'confirmed', 'moved', 'declined', 'cancelled_by_salon', 'cancelled_by_customer',
  'job_assigned', 'job_moved', 'job_removed'));

create function private.notify_stylist(p_stylist uuid, p_kind text, a public.appointments)
returns void language sql security definer set search_path = '' as $$
  select private.notify(p.id, p_kind, a) from public.stylists s join public.profiles p on p.id = s.profile_id
   where s.id = p_stylist and p.role = 'stylist'
$$;

-- As before for customers and the salon; a stylist hears about confirmed jobs only.
create or replace function private.on_appointment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then perform private.notify_admins('booked', new); end if;
    if new.status = 'confirmed' then perform private.notify_stylist(new.stylist_id, 'job_assigned', new); end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'pending' then
      perform private.notify(new.customer_id, 'confirmed', new);
      perform private.notify_stylist(new.stylist_id, 'job_assigned', new);
    elsif new.status = 'cancelled' and new.cancelled_by = 'salon' then
      perform private.notify(new.customer_id, case when old.status = 'pending' then 'declined' else 'cancelled_by_salon' end, new);
      if old.status = 'confirmed' then perform private.notify_stylist(new.stylist_id, 'job_removed', new); end if;
    elsif new.status = 'cancelled' and new.cancelled_by = 'customer' then
      perform private.notify_admins('cancelled_by_customer', new);
      if old.status = 'confirmed' then perform private.notify_stylist(new.stylist_id, 'job_removed', new); end if;
    end if;
  elsif (new.starts_at, new.stylist_id) is distinct from (old.starts_at, old.stylist_id) and new.status in ('pending', 'confirmed') then
    perform private.notify(new.customer_id, 'moved', new);
    if new.status = 'confirmed' then
      if new.stylist_id is distinct from old.stylist_id then
        perform private.notify_stylist(old.stylist_id, 'job_removed', old);
        perform private.notify_stylist(new.stylist_id, 'job_assigned', new);
      else
        perform private.notify_stylist(new.stylist_id, 'job_moved', new);
      end if;
    end if;
  end if;
  return new;
end $$;
