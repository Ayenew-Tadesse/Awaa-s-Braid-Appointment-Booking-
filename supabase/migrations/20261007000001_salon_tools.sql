-- The salon's tools (milestone 3).
--   save_style_options / save_working_hours: replace a style's options or a
--   stylist's week in one step (all or nothing). They run as the caller, so the
--   admin-only rules (Row Level Security) still decide; a customer changes nothing.
--   A status guard: an appointment is marked done or missed only once it has
--   started, and one the salon cancels says so.

create function public.save_style_options(p_style uuid, p_options jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the salon can change styles.' using errcode = '42501'; end if;
  delete from public.style_options where style_id = p_style;
  insert into public.style_options (style_id, kind, label, extra_minutes, extra_price, sort)
  select p_style, o ->> 'kind', o ->> 'label', coalesce((o ->> 'extra_minutes')::int, 0), coalesce((o ->> 'extra_price')::numeric, 0), ord::int
    from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) with ordinality as x(o, ord);
end $$;

create function public.save_working_hours(p_stylist uuid, p_hours jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the salon can change working hours.' using errcode = '42501'; end if;
  delete from public.working_hours where stylist_id = p_stylist;
  insert into public.working_hours (stylist_id, weekday, starts, ends)
  select p_stylist, (h ->> 'weekday')::int, (h ->> 'starts')::time, (h ->> 'ends')::time
    from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) h;
  if exists (select 1 from public.working_hours a join public.working_hours b
      on a.stylist_id = b.stylist_id and a.weekday = b.weekday and a.id < b.id and a.starts < b.ends and b.starts < a.ends
      where a.stylist_id = p_stylist) then
    raise exception 'Two blocks on the same day overlap.';
  end if;
end $$;

revoke all on function public.save_style_options(uuid, jsonb) from public, anon;
revoke all on function public.save_working_hours(uuid, jsonb) from public, anon;
grant execute on function public.save_style_options(uuid, jsonb) to authenticated;
grant execute on function public.save_working_hours(uuid, jsonb) to authenticated;

create function private.guard_appointment_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('completed', 'no_show') and new.starts_at > now() then
      raise exception 'An appointment can be marked done or missed once it has started.';
    end if;
    if new.status = 'cancelled' and new.cancelled_by is null then new.cancelled_by := 'salon'; end if;
  end if;
  return new;
end $$;
create trigger appointments_status_guard before update on public.appointments
  for each row execute function private.guard_appointment_status();
