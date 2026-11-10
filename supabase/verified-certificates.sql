-- Certificate registry. Run on the Ludo project after the existing league schema.
-- Existing players, scores and private point_events are never modified.
create schema if not exists certificate_private;
revoke all on schema certificate_private from public, anon, authenticated;
grant usage on schema certificate_private to authenticated;

create table if not exists public.league_certificates (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 issuer_id uuid not null references auth.users(id),
 request_hash text not null,
 snapshot jsonb not null,
 content_hash text not null check (length(content_hash)=64),
 issued_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 revocation_reason text,
 constraint certificate_snapshot_version check (snapshot->>'version'='1')
);
alter table public.league_certificates enable row level security;
revoke all on public.league_certificates from anon, authenticated;
grant select(id,snapshot,content_hash,issued_at,revoked_at,revocation_reason) on public.league_certificates to anon,authenticated;
drop policy if exists "Issued certificate records are publicly verifiable" on public.league_certificates;
create policy "Issued certificate records are publicly verifiable" on public.league_certificates for select to anon,authenticated using (true);

create or replace function public.get_league_certificate(p_certificate_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'snapshot',c.snapshot,'content_hash',c.content_hash,'issued_at',c.issued_at,'revoked_at',c.revoked_at,'revocation_reason',c.revocation_reason)
 from public.league_certificates c where c.id=p_certificate_id;
$$;
revoke all on function public.get_league_certificate(uuid) from public,anon,authenticated;
grant execute on function public.get_league_certificate(uuid) to anon,authenticated;

create or replace function public.league_certificate_registry_status()
returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('version',1,'available',true)$$;
revoke all on function public.league_certificate_registry_status() from public,anon,authenticated;
grant execute on function public.league_certificate_registry_status() to anon,authenticated;

create or replace function certificate_private.issue_certificate(
 p_player_id uuid,p_message text,p_event_ids uuid[],p_consent boolean,
 p_request_id uuid,p_expected_points integer,p_expected_rank integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_player public.players; v_rank integer; v_total integer; v_ties integer;
 v_id uuid:=gen_random_uuid(); v_time timestamptz:=clock_timestamp(); v_snapshot jsonb; v_comments jsonb;
 v_metrics jsonb; v_row public.league_certificates; v_selected_count integer; v_request_hash text;
begin
 if v_user is null or not exists(select 1 from public.admin_profiles where user_id=v_user and is_admin=true) then raise exception 'Only an approved scorekeeper can issue a certificate' using errcode='42501'; end if;
 if p_consent is not true then raise exception 'Confirm publication of this certificate and selected comments'; end if;
 if p_request_id is null then raise exception 'A request identifier is required'; end if;
 if char_length(coalesce(p_message,''))>600 then raise exception 'Personal messages can contain at most 600 characters'; end if;
 if coalesce(cardinality(p_event_ids),0)>100 then raise exception 'Select at most 100 table comments per certificate'; end if;
 -- Share the existing scoring lock so the rank and points form one stable snapshot.
 perform pg_advisory_xact_lock(hashtext('ludo-super-league-event-chain'));
 v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('player',p_player_id,'message',trim(coalesce(p_message,'')),'events',(select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct unnest(coalesce(p_event_ids,'{}'::uuid[])) x) q),'points',p_expected_points,'rank',p_expected_rank)::text,'UTF8'),'sha256'),'hex');
 select * into v_row from public.league_certificates where request_id=p_request_id;
 if found then
   if v_row.issuer_id<>v_user or v_row.request_hash<>v_request_hash then raise exception 'This request identifier was already used for different content'; end if;
   return public.get_league_certificate(v_row.id);
 end if;
 select * into v_player from public.players where id=p_player_id and active=true;
 if not found then raise exception 'The player is no longer active'; end if;
 select position::integer into v_rank from (select id,row_number() over(order by points_total desc,created_at asc,id asc) as position from public.players where active=true) ranked where id=p_player_id;
 select count(*),count(*) filter(where points_total=v_player.points_total) into v_total,v_ties from public.players where active=true;
 if v_player.points_total is distinct from p_expected_points or v_rank is distinct from p_expected_rank then raise exception 'The standings changed. Refresh and review the certificate before issuing it'; end if;
 select count(distinct x) into v_selected_count from unnest(coalesce(p_event_ids,'{}'::uuid[])) x;
 if v_selected_count<>(select count(*) from public.point_events where id=any(coalesce(p_event_ids,'{}'::uuid[])) and player_id=p_player_id) then raise exception 'A selected comment does not belong to this player'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('event_number',event_number,'points',points,'reason',reason,'created_at',created_at) order by event_number),'[]'::jsonb) into v_comments from public.point_events where id=any(coalesce(p_event_ids,'{}'::uuid[])) and player_id=p_player_id;
 select jsonb_build_object('count',count(*),'awards',count(*) filter(where points>0),'corrections',count(*) filter(where points<0),'positive',coalesce(sum(points) filter(where points>0),0),'corrected',coalesce(sum(points) filter(where points<0),0),'net',coalesce(sum(points),0),'average',coalesce(avg(points) filter(where points>0),0),'largest',coalesce(max(points) filter(where points>0),0),'days',count(distinct (created_at at time zone 'Europe/Paris')::date)) into v_metrics from public.point_events where player_id=p_player_id;
 v_snapshot:=jsonb_build_object('version',1,'player',jsonb_build_object('id',v_player.id,'name',v_player.name,'points_total',v_player.points_total),'rank',v_rank,'total',v_total,'tie_count',v_ties,'metrics',v_metrics,'message',trim(coalesce(p_message,'')),'comments',v_comments,'issued_at',v_time,'certificate_id',v_id);
 insert into public.league_certificates(id,request_id,issuer_id,request_hash,snapshot,content_hash,issued_at) values(v_id,p_request_id,v_user,v_request_hash,v_snapshot,encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'),v_time);
 return public.get_league_certificate(v_id);
end $$;
revoke all on function certificate_private.issue_certificate(uuid,text,uuid[],boolean,uuid,integer,integer) from public,anon,authenticated;
grant execute on function certificate_private.issue_certificate(uuid,text,uuid[],boolean,uuid,integer,integer) to authenticated;
create or replace function public.issue_league_certificate(p_player_id uuid,p_message text,p_event_ids uuid[],p_consent boolean,p_request_id uuid,p_expected_points integer,p_expected_rank integer)
returns jsonb language sql security invoker set search_path='' as $$ select certificate_private.issue_certificate(p_player_id,p_message,p_event_ids,p_consent,p_request_id,p_expected_points,p_expected_rank) $$;
revoke all on function public.issue_league_certificate(uuid,text,uuid[],boolean,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.issue_league_certificate(uuid,text,uuid[],boolean,uuid,integer,integer) to authenticated;

create or replace function certificate_private.revoke_certificate(p_certificate_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_admin=true) then raise exception 'Only an approved scorekeeper can revoke certificates' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_reason,''))) not between 3 and 300 then raise exception 'Provide a revocation reason between 3 and 300 characters'; end if;
 update public.league_certificates set revoked_at=coalesce(revoked_at,clock_timestamp()),revocation_reason=case when revoked_at is null then trim(p_reason) else revocation_reason end where id=p_certificate_id;
 if not found then raise exception 'Certificate not found'; end if;
 return public.get_league_certificate(p_certificate_id);
end $$;
revoke all on function certificate_private.revoke_certificate(uuid,text) from public,anon,authenticated;
grant execute on function certificate_private.revoke_certificate(uuid,text) to authenticated;
create or replace function public.revoke_league_certificate(p_certificate_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$select certificate_private.revoke_certificate(p_certificate_id,p_reason)$$;
revoke all on function public.revoke_league_certificate(uuid,text) from public,anon,authenticated;
grant execute on function public.revoke_league_certificate(uuid,text) to authenticated;
