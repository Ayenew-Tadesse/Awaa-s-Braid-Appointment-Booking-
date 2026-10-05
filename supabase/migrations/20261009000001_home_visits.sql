-- Home visits: the stylist goes to the customer's home; there is no salon to visit.
--   salon          service_zips: the ZIP codes we travel to (their first three digits);
--                  travel_minutes: time kept free after each appointment to get to the next home
--   profiles       the customer's home address (saved for next time; only they and the salon see it)
--   appointments   the address of the visit, as it was when booked; busy_until = ends_at + travel
-- Addresses are never in busy_times() or in notifications.

alter table public.salon
  add column service_zips text[] not null default array['200', '201', '202', '203', '204', '205', '206', '207', '208', '209']
    check (cardinality(service_zips) between 1 and 100 and array_to_string(service_zips, ',') ~ '^[0-9]{3}(,[0-9]{3})*$'),
  add column travel_minutes int not null default 60 check (travel_minutes between 0 and 240);

alter table public.profiles
  add column address text check (char_length(address) <= 200),
  add column city text check (char_length(city) <= 80),
  add column zip text check (zip ~ '^[0-9]{5}$');

alter table public.appointments
  add column visit_address text check (char_length(visit_address) <= 200),
  add column visit_city text check (char_length(visit_city) <= 80),
  add column visit_zip text check (visit_zip ~ '^[0-9]{5}$'),
  add column busy_until timestamptz;

-- busy_until is always the end plus the salon's travel time (set here, whatever the app sends).
create function private.set_busy_until() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.busy_until := new.ends_at + make_interval(mins => coalesce((select travel_minutes from public.salon limit 1), 0));
  return new;
end $$;
create trigger appointments_busy_until before insert or update of starts_at, ends_at, busy_until on public.appointments
  for each row execute function private.set_busy_until();
update public.appointments set busy_until = ends_at
  + make_interval(mins => coalesce((select travel_minutes from public.salon limit 1), 0));
alter table public.appointments alter column busy_until set not null;

-- A stylist is never double-booked, travel time included.
alter table public.appointments drop constraint appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap exclude using gist (
  stylist_id with =, tstzrange(starts_at, busy_until) with &&
) where (status in ('pending', 'confirmed'));

-- Busy times for free slots: each open appointment holds the travel time before
-- and after it (a new visit must end, plus travel, before it starts). Still only
-- who is busy and when: no customer, no address.
create or replace function public.busy_times(p_from timestamptz, p_to timestamptz)
returns table (stylist_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.stylist_id, a.starts_at - make_interval(mins => coalesce((select travel_minutes from public.salon limit 1), 0)), a.busy_until
    from public.appointments a
   where a.status in ('pending', 'confirmed') and a.busy_until > p_from
     and a.starts_at - make_interval(mins => coalesce((select travel_minutes from public.salon limit 1), 0)) < p_to
     and p_to - p_from <= interval '62 days'
  union all
  select t.stylist_id, t.starts_at, t.ends_at from public.time_off t
   where t.starts_at < p_to and t.ends_at > p_from and p_to - p_from <= interval '62 days'
$$;

create or replace function private.stylist_free(p_stylist uuid, p_start timestamptz, p_end timestamptz)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare tz text; travel int; ls timestamp; le timestamp;
begin
  select timezone, travel_minutes into tz, travel from public.salon limit 1;
  ls := p_start at time zone coalesce(tz, 'UTC');
  le := p_end at time zone coalesce(tz, 'UTC');
  if not exists (select 1 from public.stylists where id = p_stylist and active) then return false; end if;
  if not exists (select 1 from public.working_hours w where w.stylist_id = p_stylist
      and w.weekday = extract(dow from ls)::int and w.starts <= ls::time and w.ends >= le::time and le::date = ls::date) then
    return false;
  end if;
  if exists (select 1 from public.time_off t where t.stylist_id = p_stylist and t.starts_at < p_end and t.ends_at > p_start) then return false; end if;
  if exists (select 1 from public.appointments a where a.stylist_id = p_stylist and a.status in ('pending', 'confirmed')
      and a.starts_at < p_end + make_interval(mins => coalesce(travel, 0)) and a.busy_until > p_start) then return false; end if;
  return true;
end $$;

-- Booking now says where: the address given (also saved on the profile for next
-- time), or the one saved before. Only ZIP codes the salon travels to.
drop function public.book_appointment(uuid, uuid[], uuid, timestamptz, text);
create function public.book_appointment(p_style uuid, p_options uuid[], p_stylist uuid, p_starts_at timestamptz, p_note text default null,
  p_address text default null, p_city text default null, p_zip text default null)
returns public.appointments
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s public.salon; st public.styles; p public.profiles;
  opts jsonb; mins int; total numeric; n_opts int; ends timestamptz; who uuid;
  local_start timestamp; result public.appointments;
  v_address text; v_city text; v_zip text;
begin
  select * into p from public.profiles where id = me;
  if me is null or p.id is null then
    raise exception 'Please sign in to book.' using errcode = '42501';
  end if;
  select * into s from public.salon limit 1;
  select * into st from public.styles where id = p_style and active;
  if st.id is null then raise exception 'That style is no longer available.'; end if;

  v_address := nullif(left(trim(coalesce(p_address, p.address, '')), 200), '');
  v_city := nullif(left(trim(coalesce(p_city, p.city, '')), 80), '');
  v_zip := nullif(trim(coalesce(p_zip, p.zip, '')), '');
  if v_address is null or char_length(v_address) < 5 or v_city is null or char_length(v_city) < 2 then
    raise exception 'Please add the address where we should come.';
  end if;
  if v_zip !~ '^[0-9]{5}$' then raise exception 'Please enter a 5-digit ZIP code.'; end if;
  if not (left(v_zip, 3) = any (s.service_zips)) then
    raise exception 'Sorry, we don''t travel to that ZIP code yet.';
  end if;

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
    insert into public.appointments (customer_id, stylist_id, style_id, style_name, options, starts_at, ends_at, price, status, note,
      visit_address, visit_city, visit_zip)
    values (me, who, st.id, st.name, opts, p_starts_at, ends, total, 'pending', nullif(left(trim(coalesce(p_note, '')), 500), ''),
      v_address, v_city, v_zip)
    returning * into result;
  exception when exclusion_violation then
    raise exception 'That time is no longer free. Please pick another.';
  end;
  -- Saved for next time.
  update public.profiles set address = v_address, city = v_city, zip = v_zip where id = me;
  return result;
end $$;

revoke all on function public.book_appointment(uuid, uuid[], uuid, timestamptz, text, text, text, text) from public, anon;
grant execute on function public.book_appointment(uuid, uuid[], uuid, timestamptz, text, text, text, text) to authenticated;

