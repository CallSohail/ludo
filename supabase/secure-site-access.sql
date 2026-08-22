-- Legacy filename retained for existing installations.
-- The leaderboard is now public, while admin writes remain authenticated.

grant usage on schema public to anon;
grant select on public.players to anon;
grant select on public.players to authenticated;

drop policy if exists "public can see active players" on public.players;
drop policy if exists "authenticated users can see active players" on public.players;
create policy "public can see active players"
  on public.players for select
  to anon
  using (active = true);
create policy "authenticated users can see active players"
  on public.players for select
  to authenticated
  using (active = true);

-- Verification: both values should be true.
select
  has_table_privilege('anon', 'public.players', 'select') as anon_can_read,
  has_table_privilege('authenticated', 'public.players', 'select') as signed_in_can_read;
