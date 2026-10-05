-- A starting point for your real salon (run once in the Supabase SQL Editor,
-- after every file in supabase/migrations). It adds the salon, the usual
-- braiding styles with sample US-dollar prices and options, and one stylist
-- working Monday to Saturday, 9:00 AM to 7:00 PM. Change any of it afterwards in
-- the app under Salon. Replace the details marked "EDIT ME" first.
-- It refuses to run twice (if a salon is already there, nothing changes).
do $$
declare sid uuid;
begin
  if exists (select 1 from public.salon) then
    raise exception 'A salon is already set up. Change it in the app under Salon.';
  end if;

  insert into public.salon (name, tagline, phone, address, city)
  values ('Awaa Braids', 'Braids done with care, booked in a minute.',
          '(000) 000-0000',             -- EDIT ME: the salon's phone
          'Street, City, State',        -- EDIT ME: the salon's address
          'Washington, DC area');

  -- The usual styles with sample prices (change them in the app).
  insert into public.styles (name, category, duration_minutes, price, description, sort) values
    ('Knotless braids', 'braids', 240, 250, 'Light, flat braids that start with your own hair, so they''re gentle on the scalp.', 1),
    ('Box braids', 'braids', 210, 210, 'Classic square-parted braids that last for weeks.', 2),
    ('Fulani braids', 'braids', 180, 230, 'Cornrows at the front and braids at the back, with beads if you like.', 3),
    ('Passion twists', 'twists', 180, 200, 'Soft, bohemian two-strand twists.', 4),
    ('Cornrows', 'cornrows', 90, 70, 'Neat rows close to the scalp, straight back or in a design.', 5),
    ('Kids'' braids', 'kids', 90, 60, 'Gentle styles for children under 12, with breaks when they need them.', 6),
    ('Takedown and wash', 'other', 60, 40, 'We take out your old braids and wash your hair.', 7);

  -- Sizes and lengths for the braids and twists; a pattern design for cornrows.
  insert into public.style_options (style_id, kind, label, extra_minutes, extra_price, sort)
  select s.id, o.kind, o.label, o.mins, o.price, o.sort
    from public.styles s
    cross join (values ('size', 'Small', 60, 60, 1), ('size', 'Medium', 0, 0, 2), ('size', 'Large', -45, -30, 3),
                       ('length', 'Shoulder', 0, 0, 4), ('length', 'Mid-back', 45, 40, 5), ('length', 'Waist', 90, 80, 6)) o(kind, label, mins, price, sort)
   where s.name in ('Knotless braids', 'Box braids', 'Fulani braids', 'Passion twists');
  insert into public.style_options (style_id, kind, label, extra_minutes, extra_price, sort)
  select id, 'extra', 'Pattern design', 30, 25, 1 from public.styles where name in ('Cornrows', 'Kids'' braids');

  -- One stylist to start with: rename them in the app (Salon, Stylists and hours) and add the others there.
  insert into public.stylists (name, bio, sort) values ('Stylist 1', null, 1) returning id into sid;
  insert into public.working_hours (stylist_id, weekday, starts, ends)
  select sid, d, '09:00', '19:00' from generate_series(1, 6) d;
end $$;
