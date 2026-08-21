-- Run this once in the Supabase SQL Editor for an existing database.
-- Supabase installs pgcrypto functions in the extensions schema.
-- The previous function could not find digest(), so points were rejected.

alter function public.add_point_event(uuid, integer, text, boolean)
set search_path = extensions, public, pg_temp;

-- Optional verification, run after the website submits a test point:
-- select name, points_total from public.players order by points_total desc;
