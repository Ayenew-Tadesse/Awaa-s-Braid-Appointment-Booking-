-- Who may see and do what. Row Level Security on every table; customers book
-- and cancel only through the functions below, which check the salon's rules
-- (hours, notice, no double-booking) on the server, not just in the app.

create schema if not exists private;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

/* ------------------------------------------------- accounts */

-- A new login gets a customer profile (name and phone from sign-up). Nobody
-- can sign themselves up as an administrator: the role isn't read from sign-up data.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, 'customer',
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Only an administrator changes anyone's role (including their own). With no
-- signed-in person (the SQL editor, the server), the owner makes the first admin.
create function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only the salon can change roles.' using errcode = '42501';
  end if;
  if new.id <> old.id then raise exception 'A profile keeps its id.' using errcode = '42501'; end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile();

/* ------------------------------------------------- row level security */

alter table public.salon enable row level security;
alter table public.profiles enable row level security;
alter table public.styles enable row level security;
alter table public.style_options enable row level security;
alter table public.stylists enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.appointments enable row level security;

-- The catalogue is public (anyone can look before signing in); the salon edits it.
create policy salon_read on public.salon for select to anon, authenticated using (true);
create policy salon_admin on public.salon for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy styles_read on public.styles for select to anon, authenticated using (active or private.is_admin());
create policy styles_admin on public.styles for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy options_read on public.style_options for select to anon, authenticated
  using (private.is_admin() or exists (select 1 from public.styles s where s.id = style_id and s.active));
create policy options_admin on public.style_options for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy stylists_read on public.stylists for select to anon, authenticated using (active or private.is_admin());
create policy stylists_admin on public.stylists for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy hours_read on public.working_hours for select to anon, authenticated using (true);
create policy hours_admin on public.working_hours for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Time off (and its reason) is the salon's own; customers only see that the time is taken (busy_times).
create policy time_off_admin on public.time_off for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Your own profile; the salon sees everyone's (to know who is coming).
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or private.is_admin()) with check (id = auth.uid() or private.is_admin());

-- Your own appointments; the salon sees and manages all of them.
create policy appointments_read on public.appointments for select to authenticated using (customer_id = auth.uid() or private.is_admin());
create policy appointments_admin on public.appointments for all to authenticated using (private.is_admin()) with check (private.is_admin());

grant select on public.salon, public.styles, public.style_options, public.stylists, public.working_hours to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

/* ------------------------------------------------- booking */

-- When the stylists are busy (open appointments and time off), with nothing
-- about who booked: what the booking screen needs to offer free times.
create function public.busy_times(p_from timestamptz, p_to timestamptz)
returns table (stylist_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.stylist_id, a.starts_at, a.ends_at from public.appointments a
   where a.status in ('pending', 'confirmed') and a.starts_at < p_to and a.ends_at > p_from
     and p_to - p_from <= interval '62 days'
  union all
  select t.stylist_id, t.starts_at, t.ends_at from public.time_off t
   where t.starts_at < p_to and t.ends_at > p_from and p_to - p_from <= interval '62 days'
$$;

-- Does [p_start, p_end) fit within one of the stylist's working-hours blocks that day
-- (in the salon's time zone), with no time off or other open appointment?
create function private.stylist_free(p_stylist uuid, p_start timestamptz, p_end timestamptz)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare tz text; ls timestamp; le timestamp;
begin
  select timezone into tz from public.salon limit 1;
  ls := p_start at time zone coalesce(tz, 'UTC');
  le := p_end at time zone coalesce(tz, 'UTC');
  if not exists (select 1 from public.stylists where id = p_stylist and active) then return false; end if;
  if not exists (select 1 from public.working_hours w where w.stylist_id = p_stylist
      and w.weekday = extract(dow from ls)::int and w.starts <= ls::time and w.ends >= le::time and le::date = ls::date) then
    return false;
  end if;
  if exists (select 1 from public.time_off t where t.stylist_id = p_stylist and t.starts_at < p_end and t.ends_at > p_start) then return false; end if;
  if exists (select 1 from public.appointments a where a.stylist_id = p_stylist and a.status in ('pending', 'confirmed')
      and a.starts_at < p_end and a.ends_at > p_start) then return false; end if;
  return true;
end $$;

-- Book an appointment as the signed-in customer. The time and price come from
-- the style and options on the server; it starts as "pending" until the salon
-- confirms. p_stylist null = any free stylist.
create function public.book_appointment(p_style uuid, p_options uuid[], p_stylist uuid, p_starts_at timestamptz, p_note text default null)
returns public.appointments
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s public.salon; st public.styles;
  opts jsonb; mins int; total numeric; n_opts int; ends timestamptz; who uuid;
  local_start timestamp; result public.appointments;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'Please sign in to book.' using errcode = '42501';
  end if;
  select * into s from public.salon limit 1;
  select * into st from public.styles where id = p_style and active;
  if st.id is null then raise exception 'That style is no longer available.'; end if;

  p_options := coalesce(p_options, '{}');
  select count(*), coalesce(sum(o.extra_minutes), 0), coalesce(sum(o.extra_price), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'label', o.label) order by o.sort), '[]'::jsonb)
    into n_opts, mins, total, opts
    from public.style_options o where o.style_id = st.id and o.id = any (p_options);
  if n_opts <> cardinality(p_options) then raise exception 'Choose options from this style.'; end if;
  if exists (select 1 from public.style_options o where o.id = any (p_options) and o.kind in ('size', 'length')
      group by o.kind having count(*) > 1) then
    raise exception 'Choose one size and one length.';
  end if;
  mins := greatest(15, st.duration_minutes + mins);
  total := greatest(0, st.price + total);
  ends := p_starts_at + make_interval(mins => mins);

  local_start := p_starts_at at time zone s.timezone;
  if p_starts_at < now() + make_interval(hours => s.min_notice_hours) then
    raise exception 'Please book at least % hours ahead.', s.min_notice_hours;
  end if;
  if p_starts_at > now() + make_interval(days => s.booking_window_days) then
    raise exception 'Bookings open % days ahead.', s.booking_window_days;
  end if;
  if (extract(hour from local_start) * 60 + extract(minute from local_start))::int % s.slot_minutes <> 0
     or extract(second from local_start) <> 0 then
    raise exception 'Pick one of the offered times.';
  end if;
  -- No more than 3 upcoming open bookings per customer (keeps the diary honest).
  if (select count(*) from public.appointments where customer_id = me and status in ('pending', 'confirmed') and starts_at > now()) >= 3 then
    raise exception 'You already have 3 upcoming appointments. Cancel one to book another.';
  end if;

  if p_stylist is not null then
    if not private.stylist_free(p_stylist, p_starts_at, ends) then raise exception 'That time is no longer free. Please pick another.'; end if;
    who := p_stylist;
  else
    select id into who from public.stylists where active and private.stylist_free(id, p_starts_at, ends) order by sort, name limit 1;
    if who is null then raise exception 'That time is no longer free. Please pick another.'; end if;
  end if;

  begin
    insert into public.appointments (customer_id, stylist_id, style_id, style_name, options, starts_at, ends_at, price, status, note)
    values (me, who, st.id, st.name, opts, p_starts_at, ends, total, 'pending', nullif(left(trim(coalesce(p_note, '')), 500), ''))
    returning * into result;
  exception when exclusion_violation then
    raise exception 'That time is no longer free. Please pick another.';
  end;
  return result;
end $$;

-- Cancel your own appointment: a request still waiting for the salon any time
-- before it starts; a confirmed one up to the salon's notice (cancel_hours).
create function public.cancel_appointment(p_id uuid)
returns public.appointments
language plpgsql security definer set search_path = '' as $$
declare a public.appointments; hrs int; result public.appointments;
begin
  select * into a from public.appointments where id = p_id and customer_id = auth.uid();
  if a.id is null then raise exception 'Appointment not found.' using errcode = '42501'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'This appointment can no longer be cancelled.'; end if;
  if a.starts_at <= now() then raise exception 'This appointment has already started.'; end if;
  select cancel_hours into hrs from public.salon limit 1;
  if a.status = 'confirmed' and a.starts_at < now() + make_interval(hours => coalesce(hrs, 0)) then
    raise exception 'Confirmed appointments can be cancelled up to % hours before. Please call the salon.', hrs;
  end if;
  update public.appointments set status = 'cancelled', cancelled_by = 'customer' where id = a.id returning * into result;
  return result;
end $$;

revoke all on function public.book_appointment(uuid, uuid[], uuid, timestamptz, text) from public, anon;
revoke all on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.book_appointment(uuid, uuid[], uuid, timestamptz, text) to authenticated;
grant execute on function public.cancel_appointment(uuid) to authenticated;
grant execute on function public.busy_times(timestamptz, timestamptz) to anon, authenticated;
