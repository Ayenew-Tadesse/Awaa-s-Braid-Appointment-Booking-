-- Awaa Braids: one salon, its braiding styles and stylists, and appointments.
--
-- Who may see and do what (Row Level Security, in 20261005000002_security.sql):
--   anyone            the salon, its active styles and options, stylists and working hours
--   a customer        their own profile and their own appointments; books and cancels
--                     only through book_appointment() / cancel_appointment()
--   an administrator  everything; confirms, reschedules and completes appointments
-- Nobody sees another customer's name, phone or appointments.

create extension if not exists btree_gist;

-- The salon (one row): its details and booking rules.
create table public.salon (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  phone text,
  address text,
  city text,
  timezone text not null default 'Africa/Addis_Ababa',
  currency text not null default 'ETB',
  slot_minutes int not null default 30 check (slot_minutes between 5 and 120),
  min_notice_hours int not null default 2 check (min_notice_hours between 0 and 168),
  booking_window_days int not null default 60 check (booking_window_days between 1 and 365),
  cancel_hours int not null default 24 check (cancel_hours between 0 and 168),
  created_at timestamptz not null default now()
);
create unique index salon_single_row on public.salon ((true));

-- Everyone who signs in. Customers sign up themselves; only an administrator makes another administrator.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now()
);

-- What can be booked: a style with a base time and price; options (size, length) add to both.
create table public.styles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  category text not null default 'braids' check (category in ('braids', 'cornrows', 'twists', 'locs', 'kids', 'other')),
  image_url text,
  duration_minutes int not null check (duration_minutes between 15 and 720),
  price numeric(10, 2) not null check (price >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.style_options (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.styles (id) on delete cascade,
  kind text not null check (kind in ('size', 'length', 'extra')),
  label text not null check (char_length(label) between 1 and 60),
  extra_minutes int not null default 0 check (extra_minutes between -240 and 480),
  extra_price numeric(10, 2) not null default 0,
  sort int not null default 0
);
create index on public.style_options (style_id);

-- Who braids. Stylists don't sign in (yet): the salon manages their hours.
create table public.stylists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  bio text check (char_length(bio) <= 300),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Weekly hours, in the salon's time zone (weekday 0 = Sunday). Two rows on a day make a break between them.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  starts time not null,
  ends time not null,
  check (ends > starts)
);
create index on public.working_hours (stylist_id, weekday);

-- Days off and blocked time (the reason is for the salon only).
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  check (ends_at > starts_at)
);
create index on public.time_off (stylist_id, starts_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  stylist_id uuid not null references public.stylists (id),
  style_id uuid not null references public.styles (id),
  -- What was chosen, as it was when booked (labels and prices can change later).
  style_name text not null,
  options jsonb not null default '[]'::jsonb,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price numeric(10, 2) not null check (price >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  note text check (char_length(note) <= 500),
  cancelled_by text check (cancelled_by in ('customer', 'salon')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- A stylist is never double-booked: open appointments can't overlap.
  constraint appointments_no_overlap exclude using gist (
    stylist_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'))
);
create index on public.appointments (customer_id, starts_at);
create index on public.appointments (starts_at);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();
