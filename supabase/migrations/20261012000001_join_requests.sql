-- Stylists asking to join the team (the staff website's "Join the team").
-- Signing up there marks the new account as a request; it is still an ordinary
-- customer account with no access to anything more. The salon (an admin) then
-- links it to a stylist, or declines it. Nobody can make themselves a stylist.

alter table public.profiles add column wants_stylist boolean not null default false;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name, phone, wants_stylist)
  values (new.id, 'customer',
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30), ''),
    coalesce(new.raw_user_meta_data ->> 'join_team', '') = 'true');
  return new;
end $$;

-- A request can only be withdrawn by its owner or settled by the salon, never granted by anyone but the salon.
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only the salon can change roles.' using errcode = '42501';
  end if;
  if new.wants_stylist and not old.wants_stylist and auth.uid() is not null and not private.is_admin() then
    raise exception 'Ask to join the team by signing up on the staff website.' using errcode = '42501';
  end if;
  if new.id <> old.id then raise exception 'A profile keeps its id.' using errcode = '42501'; end if;
  return new;
end $$;

-- Link a waiting account (by its profile, no email needed) to a stylist.
create function public.link_stylist_profile(p_stylist uuid, p_profile uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  if not private.is_admin() then raise exception 'Only the salon can link stylist logins.' using errcode = '42501'; end if;
  if not exists (select 1 from public.stylists where id = p_stylist and removed_at is null) then raise exception 'Stylist not found.'; end if;
  select role into r from public.profiles where id = p_profile;
  if r is null then raise exception 'Account not found.'; end if;
  if r = 'admin' then raise exception 'That is an admin account.'; end if;
  if exists (select 1 from public.stylists where profile_id = p_profile and id <> p_stylist) then
    raise exception 'That account is already linked to another stylist.';
  end if;
  update public.profiles set role = 'customer'
   where id = (select profile_id from public.stylists where id = p_stylist) and id <> p_profile and role = 'stylist';
  update public.stylists set profile_id = p_profile where id = p_stylist;
  update public.profiles set role = 'stylist', wants_stylist = false where id = p_profile;
end $$;

-- Linking by email goes the same way.
create or replace function public.link_stylist_login(p_stylist uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare who uuid;
begin
  if not private.is_admin() then raise exception 'Only the salon can link stylist logins.' using errcode = '42501'; end if;
  select u.id into who from auth.users u where lower(u.email) = lower(trim(p_email));
  if who is null then raise exception 'No account uses that email yet. Ask the stylist to sign up first.'; end if;
  perform public.link_stylist_profile(p_stylist, who);
end $$;

revoke all on function public.link_stylist_profile(uuid, uuid) from public, anon;
grant execute on function public.link_stylist_profile(uuid, uuid) to authenticated;
