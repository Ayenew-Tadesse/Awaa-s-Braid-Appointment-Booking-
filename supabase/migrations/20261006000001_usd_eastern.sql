-- The salon is in the Washington, DC area: prices in US dollars and times in
-- US Eastern Time (daylight saving is handled by the time zone).
alter table public.salon alter column timezone set default 'America/New_York';
alter table public.salon alter column currency set default 'USD';
-- A salon added with the earlier defaults moves over too.
update public.salon set timezone = 'America/New_York', currency = 'USD'
 where timezone = 'Africa/Addis_Ababa' and currency = 'ETB';
