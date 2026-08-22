-- Complete Ludo player and score management upgrade.
-- Run once in Supabase SQL Editor after schema.sql.

alter table public.point_events add column if not exists event_type text not null default 'penalty';
alter table public.point_events drop constraint if exists point_events_points_check;
alter table public.point_events add constraint point_events_points_check check (points between -999 and 999 and points <> 0);
alter table public.point_events drop constraint if exists point_events_event_type_check;
alter table public.point_events add constraint point_events_event_type_check check (event_type in ('penalty', 'adjustment'));

create or replace function public.admin_update_player(p_player_id uuid, p_name text, p_accent text, p_emoji text)
returns public.players language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_player public.players;
begin
  if not public.is_admin() then raise exception 'Only an approved scorekeeper can update players'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 28 then raise exception 'Player names must be between 2 and 28 characters'; end if;
  if exists (select 1 from public.players where id <> p_player_id and lower(name) = lower(trim(p_name))) then raise exception 'That player name is already in use'; end if;
  update public.players set name=trim(p_name), accent=left(coalesce(p_accent,'#ff5b3d'),20), emoji=left(coalesce(p_emoji,'🎲'),8)
  where id=p_player_id and active=true returning * into v_player;
  if not found then raise exception 'Active player not found'; end if;
  return v_player;
end $$;

create or replace function public.admin_archive_player(p_player_id uuid)
returns public.players language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_player public.players;
begin
  if not public.is_admin() then raise exception 'Only an approved scorekeeper can archive players'; end if;
  if (select count(*) from public.players where active) <= 1 then raise exception 'The final active player cannot be archived'; end if;
  update public.players set active=false where id=p_player_id and active=true returning * into v_player;
  if not found then raise exception 'Active player not found'; end if;
  return v_player;
end $$;

create or replace function public.add_point_event(p_player_id uuid, p_points integer, p_reason text, p_consent boolean)
returns public.point_events language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_event public.point_events; v_previous_hash text; v_event_number bigint; v_created_at timestamptz:=clock_timestamp(); v_payload text;
begin
  if not public.is_admin() then raise exception 'Only an approved scorekeeper can add points'; end if;
  if p_consent is not true then raise exception 'The scorekeeper must confirm this point'; end if;
  if p_points is null or p_points < 1 or p_points > 999 then raise exception 'Points must be between 1 and 999'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 3 and 180 then raise exception 'Add a reason between 3 and 180 characters'; end if;
  perform pg_advisory_xact_lock(hashtext('ludo-super-league-event-chain'));
  perform 1 from public.players where id=p_player_id and active=true for update;
  if not found then raise exception 'That player is not active on the board'; end if;
  select event_hash into v_previous_hash from public.point_events order by event_number desc limit 1;
  v_previous_hash:=coalesce(v_previous_hash,'GENESIS-LUDO-SUPER-LEAGUE-2026');
  v_event_number:=nextval(pg_get_serial_sequence('public.point_events','event_number'));
  v_payload:=concat_ws('|',v_previous_hash,v_event_number,p_player_id,p_points,trim(p_reason),auth.uid(),v_created_at);
  update public.players set points_total=points_total+p_points where id=p_player_id;
  insert into public.point_events(event_number,player_id,points,reason,consent,previous_hash,event_hash,created_by,created_at,event_type)
  values(v_event_number,p_player_id,p_points,trim(p_reason),true,v_previous_hash,encode(extensions.digest(convert_to(v_payload,'UTF8'),'sha256'::text),'hex'),(select auth.uid()),v_created_at,'penalty') returning * into v_event;
  return v_event;
end $$;

create or replace function public.admin_adjust_score(p_player_id uuid, p_delta integer, p_reason text, p_consent boolean)
returns public.point_events language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_event public.point_events; v_player public.players; v_previous_hash text; v_event_number bigint; v_created_at timestamptz:=clock_timestamp(); v_payload text;
begin
  if not public.is_admin() then raise exception 'Only an approved scorekeeper can correct scores'; end if;
  if p_consent is not true then raise exception 'The scorekeeper must confirm this correction'; end if;
  if p_delta is null or p_delta=0 or abs(p_delta)>999 then raise exception 'Correction must be between -999 and 999, excluding zero'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 3 and 180 then raise exception 'Add a reason between 3 and 180 characters'; end if;
  perform pg_advisory_xact_lock(hashtext('ludo-super-league-event-chain'));
  select * into v_player from public.players where id=p_player_id and active=true for update;
  if not found then raise exception 'That player is not active on the board'; end if;
  if v_player.points_total+p_delta < 0 then raise exception 'A score cannot become negative'; end if;
  select event_hash into v_previous_hash from public.point_events order by event_number desc limit 1;
  v_previous_hash:=coalesce(v_previous_hash,'GENESIS-LUDO-SUPER-LEAGUE-2026');
  v_event_number:=nextval(pg_get_serial_sequence('public.point_events','event_number'));
  v_payload:=concat_ws('|',v_previous_hash,v_event_number,p_player_id,p_delta,trim(p_reason),auth.uid(),v_created_at);
  update public.players set points_total=points_total+p_delta where id=p_player_id;
  insert into public.point_events(event_number,player_id,points,reason,consent,previous_hash,event_hash,created_by,created_at,event_type)
  values(v_event_number,p_player_id,p_delta,trim(p_reason),true,v_previous_hash,encode(extensions.digest(convert_to(v_payload,'UTF8'),'sha256'::text),'hex'),(select auth.uid()),v_created_at,'adjustment') returning * into v_event;
  return v_event;
end $$;

create or replace function public.get_public_score_history()
returns table(event_number bigint, player_id uuid, points integer, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.event_number,e.player_id,e.points,e.created_at from public.point_events e
  join public.players p on p.id=e.player_id where p.active=true order by e.event_number asc limit 500;
$$;

revoke all on function public.admin_update_player(uuid,text,text,text), public.admin_archive_player(uuid), public.admin_adjust_score(uuid,integer,text,boolean) from public;
grant execute on function public.admin_update_player(uuid,text,text,text), public.admin_archive_player(uuid), public.admin_adjust_score(uuid,integer,text,boolean) to authenticated;
revoke all on function public.get_public_score_history() from public;
grant execute on function public.get_public_score_history() to anon, authenticated;

select 'CRUD upgrade ready' as status;
