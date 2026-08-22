-- Ludo Super League point-scoring repair
-- Safe to run more than once in Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.add_point_event(
  p_player_id uuid,
  p_points integer,
  p_reason text,
  p_consent boolean
)
returns public.point_events
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_event public.point_events;
  v_previous_hash text;
  v_event_number bigint;
  v_created_at timestamptz := clock_timestamp();
  v_payload text;
begin
  if not public.is_admin() then
    raise exception 'Only an approved scorekeeper can add points';
  end if;
  if p_consent is not true then
    raise exception 'The scorekeeper must confirm this point';
  end if;
  if p_points is null or p_points < 1 or p_points > 9 then
    raise exception 'Points must be between 1 and 9';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 or char_length(trim(p_reason)) > 180 then
    raise exception 'Add a reason between 3 and 180 characters';
  end if;

  perform pg_advisory_xact_lock(hashtext('ludo-super-league-event-chain'));

  perform 1 from public.players where id = p_player_id and active = true for update;
  if not found then
    raise exception 'That player is not active on the board';
  end if;

  select event_hash into v_previous_hash
  from public.point_events
  order by event_number desc
  limit 1;

  v_previous_hash := coalesce(v_previous_hash, 'GENESIS-LUDO-SUPER-LEAGUE-2026');
  v_event_number := nextval(pg_get_serial_sequence('public.point_events', 'event_number'));
  v_payload := concat_ws('|', v_previous_hash, v_event_number::text, p_player_id::text,
    p_points::text, trim(p_reason), auth.uid()::text, v_created_at::text);

  update public.players
  set points_total = points_total + p_points
  where id = p_player_id;

  insert into public.point_events (
    event_number, player_id, points, reason, consent, previous_hash,
    event_hash, created_by, created_at
  ) values (
    v_event_number, p_player_id, p_points, trim(p_reason), true, v_previous_hash,
    encode(extensions.digest(convert_to(v_payload, 'UTF8'), 'sha256'::text), 'hex'),
    (select auth.uid()), v_created_at
  ) returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.add_point_event(uuid, integer, text, boolean) from public;
grant execute on function public.add_point_event(uuid, integer, text, boolean) to authenticated;

-- Verification checks. The function call itself requires a signed-in admin.
select
  to_regprocedure('public.add_point_event(uuid,integer,text,boolean)') is not null as function_ready,
  has_function_privilege('authenticated', 'public.add_point_event(uuid,integer,text,boolean)', 'execute') as authenticated_can_execute,
  has_function_privilege('anon', 'public.add_point_event(uuid,integer,text,boolean)', 'execute') as anonymous_can_execute;
