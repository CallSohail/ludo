-- Run this once in the existing Ludo Supabase project's SQL Editor.
-- It blocks anonymous leaderboard reads and requires a valid Auth session.

revoke all on public.players from anon;
grant select on public.players to authenticated;

drop policy if exists "public can see active players" on public.players;
drop policy if exists "authenticated users can see active players" on public.players;
create policy "authenticated users can see active players"
  on public.players for select
  to authenticated
  using (active = true);

-- Verification: anon should no longer have SELECT on players.
select
  has_table_privilege('anon', 'public.players', 'select') as anon_can_read,
  has_table_privilege('authenticated', 'public.players', 'select') as signed_in_can_read;
