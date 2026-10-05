-- Security and booking rules: each person sees and changes only what they
-- should, and the server enforces the salon's booking rules. Any failed check aborts the run.

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, false); execute 'set role authenticated'; end $$;
create function pg_temp.act_anon() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', false); execute 'set role anon'; end $$;
create function pg_temp.back() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', what; end if; raise notice 'ok - %', what; end $$;
-- Runs sql as the current role and reports whether it was refused (an error or nothing changed).
create function pg_temp.refused(sql text) returns boolean language plpgsql as $$
declare n int;
begin execute sql; get diagnostics n = row_count; return n = 0;
exception when others then return true; end $$;
-- The error message sql raises ('' when it works).
create function pg_temp.error_of(sql text) returns text language plpgsql as $$
begin execute sql; return '';
exception when others then return sqlerrm; end $$;
-- A time in the salon's time zone (US Eastern), some days from today: pg_temp.at(2, '10:00').
create function pg_temp.at(days int, hhmm text) returns timestamptz language sql stable as $$
  select ((date_trunc('day', now() at time zone 'America/New_York') + make_interval(days => days) + hhmm::time) at time zone 'America/New_York')
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

/* ---------------------------------------------------------------- set-up */
insert into salon (name, slot_minutes, min_notice_hours, booking_window_days, cancel_hours)
values ('Test Salon', 30, 2, 60, 24);
select pg_temp.check((select timezone || ' ' || currency from salon) = 'America/New_York USD', 'a new salon is on US Eastern Time, in US dollars');

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test', '{"full_name":"Owner"}'),
  ('c0000000-0000-0000-0000-000000000001', 'hana@test', '{"full_name":"Hana Customer","phone":"(202) 555-0101"}'),
  ('c0000000-0000-0000-0000-000000000002', 'liya@test', '{"full_name":"Liya Customer","phone":"(301) 555-0102","role":"admin"}');
select pg_temp.check((select count(*) from profiles where role = 'customer') = 3, 'every sign-up gets a customer profile');
select pg_temp.check((select phone from profiles where id = 'c0000000-0000-0000-0000-000000000001') = '(202) 555-0101', 'name and phone come from sign-up');
select pg_temp.check((select role from profiles where id = 'c0000000-0000-0000-0000-000000000002') = 'customer', 'a role in sign-up data does not make anyone an admin');
update profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001'; -- the owner, set up by hand

insert into styles (id, name, duration_minutes, price, sort, active) values
  ('5e000000-0000-0000-0000-000000000001', 'Knotless braids', 240, 2500, 1, true),
  ('5e000000-0000-0000-0000-000000000002', 'Cornrows', 90, 800, 2, true),
  ('5e000000-0000-0000-0000-000000000009', 'Retired style', 60, 500, 9, false);
insert into style_options (id, style_id, kind, label, extra_minutes, extra_price, sort) values
  ('0b000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'size', 'Small', 60, 800, 1),
  ('0b000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000001', 'size', 'Medium', 0, 0, 2),
  ('0b000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000001', 'length', 'Waist', 60, 500, 3),
  ('0b000000-0000-0000-0000-000000000009', '5e000000-0000-0000-0000-000000000002', 'size', 'Small', 30, 200, 1);
insert into stylists (id, name, sort) values
  ('51000000-0000-0000-0000-000000000001', 'Stylist One', 1),
  ('51000000-0000-0000-0000-000000000002', 'Stylist Two', 2);
-- Both work every day, 09:00 to 13:00 and 14:00 to 20:00 (lunch in between).
insert into working_hours (stylist_id, weekday, starts, ends)
  select s, d, t.a::time, t.b::time from unnest(array['51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002']::uuid[]) s,
    generate_series(0, 6) d, (values ('09:00', '13:00'), ('14:00', '20:00')) t(a, b);
insert into time_off (stylist_id, starts_at, ends_at, reason)
  values ('51000000-0000-0000-0000-000000000002', pg_temp.at(5, '09:00'), pg_temp.at(5, '19:00'), 'Private: family wedding');

/* ---------------------------------------------------------------- visitors (not signed in) */
select pg_temp.act_anon();
select pg_temp.check((select count(*) from styles) = 2, 'visitors see the active styles only');
select pg_temp.check((select count(*) from style_options) = 4, 'visitors see the options of active styles');
select pg_temp.check((select count(*) from stylists) = 2 and (select count(*) from salon) = 1, 'visitors see the salon and stylists');
select pg_temp.check(pg_temp.refused('select * from profiles'), 'visitors see no profiles');
select pg_temp.check(pg_temp.refused('select * from appointments'), 'visitors see no appointments');
select pg_temp.check(pg_temp.refused('select * from time_off'), 'visitors see no time off');
select pg_temp.check(pg_temp.refused($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(2, '10:00'))$q$), 'visitors cannot book');
select pg_temp.check((select count(*) from busy_times(pg_temp.at(5, '00:00'), pg_temp.at(6, '00:00'))) = 1, 'visitors see busy times (for free slots)');
select pg_temp.back();

/* ---------------------------------------------------------------- a customer books */
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from profiles) = 1, 'a customer sees only their own profile');
select pg_temp.check(pg_temp.refused('select * from time_off'), 'customers see no time off (or its reason)');
create temp table booked as select * from book_appointment('5e000000-0000-0000-0000-000000000001',
  array['0b000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000003']::uuid[],
  '51000000-0000-0000-0000-000000000001', pg_temp.at(2, '14:00'), '  Please use black hair  ');
grant select on booked to authenticated;
select pg_temp.check((select status from booked) = 'pending', 'a booking starts as pending');
select pg_temp.check((select ends_at - starts_at from booked) = interval '6 hours', 'the time comes from the style and options (240 + 60 + 60 min)');
select pg_temp.check((select to_char(starts_at at time zone 'America/New_York', 'HH24:MI') from booked) = '14:00', 'times are the salon''s local time');
select pg_temp.check((select price from booked) = 3800, 'the price comes from the style and options (2500 + 800 + 500)');
select pg_temp.check((select note from booked) = 'Please use black hair' and (select style_name from booked) = 'Knotless braids', 'note trimmed; style name kept');
select pg_temp.check((select jsonb_array_length(options) from booked) = 2, 'the chosen options are kept with the booking');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', '51000000-0000-0000-0000-000000000001', pg_temp.at(2, '13:30'))$q$) like '%no longer free%',
  'outside working hours (the lunch break) is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', '51000000-0000-0000-0000-000000000002', pg_temp.at(2, '19:00'))$q$) like '%no longer free%',
  'running past closing is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, now() + interval '30 minutes')$q$) like '%hours ahead%', 'too little notice is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(90, '10:00'))$q$) like '%days ahead%', 'beyond the booking window is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(2, '10:10'))$q$) like '%offered times%', 'a time off the 30-minute grid is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000009', '{}', null, pg_temp.at(2, '10:00'))$q$) like '%no longer available%', 'a retired style is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', array['0b000000-0000-0000-0000-000000000001']::uuid[], null, pg_temp.at(2, '10:00'))$q$) like '%options from this style%', 'another style''s option is refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000001', array['0b000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000002']::uuid[], null, pg_temp.at(3, '09:00'))$q$) like '%one size%', 'two sizes are refused');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', '51000000-0000-0000-0000-000000000002', pg_temp.at(5, '10:00'))$q$) like '%no longer free%', 'a stylist''s time off is refused');
-- Customers can't go around the rules.
select pg_temp.check(pg_temp.refused($q$insert into appointments (customer_id, stylist_id, style_id, style_name, starts_at, ends_at, price, status)
  values ('c0000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002', 'x', pg_temp.at(3, '10:00'), pg_temp.at(3, '11:00'), 0, 'confirmed')$q$), 'customers cannot insert appointments directly');
select pg_temp.check(pg_temp.refused($q$update appointments set status = 'confirmed', price = 0$q$), 'customers cannot confirm or re-price their appointment');
select pg_temp.check(pg_temp.refused($q$delete from appointments$q$), 'customers cannot delete appointments');
select pg_temp.check(pg_temp.refused($q$update profiles set role = 'admin' where id = 'c0000000-0000-0000-0000-000000000001'$q$), 'customers cannot make themselves admin');
update profiles set full_name = 'Hana B.' where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.check((select full_name from profiles) = 'Hana B.', 'customers can change their own name');
select pg_temp.check(pg_temp.refused($q$insert into styles (name, duration_minutes, price) values ('Mine', 60, 1)$q$), 'customers cannot change the catalogue');
select pg_temp.back();

/* ---------------------------------------------------------------- another customer */
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from appointments) = 0, 'a customer never sees another customer''s appointments');
select pg_temp.check((select count(*) from profiles) = 1, 'a customer never sees another customer''s profile');
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', '51000000-0000-0000-0000-000000000001', pg_temp.at(2, '15:00'))$q$) like '%no longer free%',
  'the same stylist cannot be double-booked');
select pg_temp.check((select stylist_id from book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(2, '15:00'))) = '51000000-0000-0000-0000-000000000002',
  '"any stylist" picks one who is free');
select pg_temp.check(pg_temp.refused($q$select cancel_appointment((select id from booked))$q$), 'a customer cannot cancel someone else''s appointment');
select pg_temp.check((select count(*) from busy_times(pg_temp.at(2, '00:00'), pg_temp.at(3, '00:00'))) = 2, 'busy times include everyone''s bookings');
select pg_temp.check(not exists (select 1 from information_schema.routines r join information_schema.parameters p using (specific_name)
  where r.routine_name = 'busy_times' and p.parameter_mode = 'OUT' and p.parameter_name not in ('stylist_id', 'starts_at', 'ends_at')), 'busy times say nothing about who booked');
-- At most 3 upcoming bookings.
select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(3, '10:00'));
select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(4, '10:00'));
select pg_temp.check(pg_temp.error_of($q$select book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(6, '10:00'))$q$) like '%3 upcoming%', 'a fourth upcoming booking is refused');
-- Cancelling a pending request frees the slot.
select pg_temp.check((select status from cancel_appointment((select id from appointments where starts_at = pg_temp.at(4, '10:00')))) = 'cancelled', 'a customer cancels their own pending request');
select pg_temp.check((select cancelled_by from appointments where starts_at = pg_temp.at(4, '10:00')) = 'customer', 'it says who cancelled');
select pg_temp.check((select count(*) from book_appointment('5e000000-0000-0000-0000-000000000002', '{}', null, pg_temp.at(4, '10:00'))) = 1, 'the freed slot can be booked again');
select pg_temp.back();

/* ---------------------------------------------------------------- the salon */
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from appointments) = 5, 'the salon sees every appointment');
select pg_temp.check((select count(*) from profiles) = 3, 'the salon sees every customer');
select pg_temp.check((select reason from time_off) like 'Private%', 'the salon sees time off with its reason');
select pg_temp.check((select count(*) from styles) = 3, 'the salon also sees retired styles');
update appointments set status = 'confirmed' where id = (select id from booked);
select pg_temp.check((select status from appointments where id = (select id from booked)) = 'confirmed', 'the salon confirms an appointment');
select pg_temp.check(pg_temp.error_of($q$update appointments set stylist_id = '51000000-0000-0000-0000-000000000002' where id = (select id from booked)$q$) like '%appointments_no_overlap%',
  'rescheduling onto a busy stylist is refused by the database');
update styles set price = 2600 where id = '5e000000-0000-0000-0000-000000000001';
select pg_temp.check((select price from appointments where id = (select id from booked)) = 3800, 'changing a price does not change booked appointments');
select pg_temp.back();

-- A confirmed appointment close to its start can't be cancelled by the customer.
update appointments set starts_at = now() + interval '3 hours', ends_at = now() + interval '9 hours' where id = (select id from booked);
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.error_of($q$select cancel_appointment((select id from booked))$q$) like '%up to 24 hours%', 'a confirmed appointment within 24 hours needs a call to the salon');
select pg_temp.back();

/* ---------------------------------------------------------------- the salon's tools (milestone 3) */
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.error_of($q$select save_style_options('5e000000-0000-0000-0000-000000000001', '[]')$q$) like '%Only the salon%', 'customers cannot replace style options');
select pg_temp.check(pg_temp.error_of($q$select save_working_hours('51000000-0000-0000-0000-000000000001', '[]')$q$) like '%Only the salon%', 'customers cannot change working hours');
select pg_temp.check(pg_temp.refused($q$insert into time_off (stylist_id, starts_at, ends_at) values ('51000000-0000-0000-0000-000000000001', now(), now() + interval '1 hour')$q$), 'customers cannot add time off');
select pg_temp.check(pg_temp.refused($q$update stylists set active = false$q$), 'customers cannot change stylists');
select pg_temp.back();

select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select save_style_options('5e000000-0000-0000-0000-000000000002', '[{"kind":"extra","label":"Pattern design","extra_minutes":30,"extra_price":25},{"kind":"extra","label":"Beads","extra_minutes":15,"extra_price":10}]');
select pg_temp.check((select string_agg(label, ',' order by sort) from style_options where style_id = '5e000000-0000-0000-0000-000000000002') = 'Pattern design,Beads', 'the salon replaces a style''s options in one step');
select save_working_hours('51000000-0000-0000-0000-000000000002', '[{"weekday":1,"starts":"10:00","ends":"18:00"}]');
select pg_temp.check((select count(*) from working_hours where stylist_id = '51000000-0000-0000-0000-000000000002') = 1, 'the salon replaces a stylist''s week');
select pg_temp.check(pg_temp.error_of($q$select save_working_hours('51000000-0000-0000-0000-000000000002', '[{"weekday":1,"starts":"09:00","ends":"14:00"},{"weekday":1,"starts":"13:00","ends":"18:00"}]')$q$) like '%overlap%', 'overlapping blocks are refused');
select pg_temp.check((select count(*) from working_hours where stylist_id = '51000000-0000-0000-0000-000000000002') = 1, 'a refused week leaves the old one as it was');
select pg_temp.check(pg_temp.error_of($q$update appointments set status = 'completed' where starts_at > now() and status = 'pending'$q$) like '%once it has started%', 'a future appointment cannot be marked done');
update appointments set status = 'cancelled' where id = (select id from appointments where status = 'pending' and starts_at > now() limit 1);
select pg_temp.check(exists (select 1 from appointments where status = 'cancelled' and cancelled_by = 'salon'), 'one the salon cancels says so');
select pg_temp.back();

/* ---------------------------------------------------------------- notifications (milestone 4) */
-- (The appointments above were made before this point too: each new request told the salon.)
select pg_temp.check((select count(*) from notifications where user_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'booked') >= 5, 'every new request tells the salon');
select pg_temp.check((select count(*) from notifications where user_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'cancelled_by_customer') >= 1, 'a customer cancelling tells the salon');
select pg_temp.check((select data ->> 'customer' from notifications where kind = 'booked' order by created_at limit 1) is not null, 'the salon''s note says who booked');

create temp table n_req as select * from appointments where customer_id = 'c0000000-0000-0000-0000-000000000002' and status = 'pending' and starts_at > now() order by starts_at limit 2;
grant select on n_req to authenticated;
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
update appointments set status = 'confirmed' where id = (select id from n_req order by starts_at limit 1);
update appointments set status = 'cancelled' where id = (select id from n_req order by starts_at desc limit 1);
select pg_temp.back();
select pg_temp.check(exists (select 1 from notifications where user_id = 'c0000000-0000-0000-0000-000000000002' and kind = 'confirmed'), 'confirming tells the customer');
select pg_temp.check(exists (select 1 from notifications where user_id = 'c0000000-0000-0000-0000-000000000002' and kind = 'declined'), 'declining a request tells the customer');

select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from notifications) > 0 and not exists (select 1 from notifications where user_id <> 'c0000000-0000-0000-0000-000000000002'), 'customers read only their own notifications');
update notifications set read_at = now();
select pg_temp.check(not exists (select 1 from notifications where read_at is null), 'customers mark their own as read');
select pg_temp.check(pg_temp.refused($q$update notifications set kind = 'booked'$q$), 'customers cannot change what a notification says');
select pg_temp.check(pg_temp.refused($q$insert into notifications (user_id, kind) values ('c0000000-0000-0000-0000-000000000002', 'confirmed')$q$), 'customers cannot make notifications');
select pg_temp.check(pg_temp.refused($q$delete from notifications$q$), 'customers cannot delete notifications');
select pg_temp.back();
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select pg_temp.check(not exists (select 1 from notifications where user_id = 'c0000000-0000-0000-0000-000000000002'), 'nobody sees another customer''s notifications');
select pg_temp.back();
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
update appointments set starts_at = starts_at + interval '14 days', ends_at = ends_at + interval '14 days' where id = (select id from n_req order by starts_at limit 1);
select pg_temp.back();
select pg_temp.check((select data ->> 'starts_at' from notifications where user_id = 'c0000000-0000-0000-0000-000000000002' and kind = 'moved')::timestamptz
  = (select starts_at + interval '14 days' from n_req order by starts_at limit 1), 'moving tells the customer the new time');
