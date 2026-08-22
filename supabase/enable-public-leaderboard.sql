-- Run once in Supabase SQL Editor.
-- Visitors can read active players without logging in.
-- Admin writes remain protected by admin-only RPC functions.

grant usage on schema public to anon;
grant select on public.players to anon;

drop policy if exists "public can see active players" on public.players;
create policy "public can see active players"
  on public.players for select
  to anon
  using (active = true);

-- Keep signed-in users able to read the same leaderboard.
drop policy if exists "authenticated users can see active players" on public.players;
create policy "authenticated users can see active players"
  on public.players for select
  to authenticated
  using (active = true);

-- Verification result should be true.
select has_table_privilege('anon', 'public.players', 'select') as public_leaderboard_enabled;
