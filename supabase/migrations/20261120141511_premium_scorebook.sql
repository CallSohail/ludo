-- Additive upgrade. Existing score rows, balances and certificate records stay intact.
alter table public.point_events
  add column if not exists request_id uuid,
  add column if not exists reverses_event_id uuid references public.point_events(id),
  add column if not exists published_reason boolean not null default false;

create unique index if not exists point_events_request_key
  on public.point_events (request_id) where request_id is not null;
create unique index if not exists point_events_one_reversal
  on public.point_events (reverses_event_id) where reverses_event_id is not null;

create schema if not exists scorebook_private;
revoke all on schema scorebook_private from public, anon, authenticated;
grant usage on schema scorebook_private to anon, authenticated;

create function scorebook_private.snapshot()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'points_total', p.points_total,
      'accent', p.accent, 'emoji', p.emoji, 'created_at', p.created_at, 'active', p.active)
      order by p.points_total desc, p.created_at, p.id)
      from public.players p where p.active), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
      'event_number', e.event_number, 'player_id', e.player_id, 'player_name', p.name,
      'points', e.points, 'created_at', e.created_at, 'event_type', e.event_type,
      'reason', case when e.published_reason then e.reason end,
      'starting_balance', e.created_at >= timestamptz '2026-08-21 00:00 Europe/Paris'
                      and e.created_at < timestamptz '2026-08-22 00:00 Europe/Paris'
    ) order by e.event_number)
      from public.point_events e join public.players p on p.id = e.player_id), '[]'::jsonb)
  );
$$;
revoke all on function scorebook_private.snapshot() from public, anon, authenticated;
grant execute on function scorebook_private.snapshot() to anon, authenticated;

create function public.get_scorebook_snapshot()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select scorebook_private.snapshot() $$;
revoke all on function public.get_scorebook_snapshot() from public, anon, authenticated;
grant execute on function public.get_scorebook_snapshot() to anon, authenticated;

create function scorebook_private.record_hash(e public.point_events)
returns text language sql stable set search_path = '' set timezone = 'UTC'
as $$
  select encode(extensions.digest(convert_to(
    case when e.request_id is null
      then concat_ws('|', e.previous_hash, e.event_number, e.player_id, e.points, e.reason, e.created_by, e.created_at)
      else jsonb_build_array(e.previous_hash, e.event_number, e.player_id, e.points, e.reason,
        e.created_by, e.created_at, e.request_id, e.reverses_event_id, e.published_reason, e.event_type)::text
    end, 'UTF8'), 'sha256'), 'hex');
$$;
revoke all on function scorebook_private.record_hash(public.point_events) from public, anon, authenticated;

create function scorebook_private.write_score(
  target uuid, delta integer, note text, witnessed boolean, request_key uuid,
  public_note boolean, kind text, original uuid
)
returns public.point_events
language plpgsql security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  actor uuid := auth.uid();
  receipt public.point_events;
  source public.point_events;
  clean_note text := trim(regexp_replace(coalesce(note, ''), '[[:cntrl:]]', '', 'g'));
  prior_balance integer;
begin
  if actor is null or not public.is_admin() then
    raise exception 'Sign in as an approved scorekeeper.' using errcode = '42501';
  end if;
  if request_key is null or witnessed is not true then
    raise exception 'Confirm the witnessed score before publishing.';
  end if;
  if kind not in ('penalty', 'adjustment') or kind is null then
    raise exception 'Choose a valid score action.';
  end if;
  perform pg_advisory_xact_lock(hashtext('ludo-super-league-event-chain'));

  if original is not null then
    select * into source from public.point_events where id = original;
    if not found or source.created_by <> actor or source.event_type <> 'penalty' or source.reverses_event_id is not null then
      raise exception 'Only the scorekeeper who published this penalty can undo it.';
    end if;
    target := source.player_id;
    delta := -source.points;
    clean_note := 'Undo of entry #' || source.event_number;
    public_note := true;
    kind := 'adjustment';
  end if;

  select * into receipt from public.point_events where request_id = request_key;
  if found then
    if receipt.created_by <> actor or receipt.player_id is distinct from target or receipt.points is distinct from delta
      or receipt.reason <> clean_note or receipt.event_type <> kind
      or receipt.reverses_event_id is distinct from original or receipt.published_reason <> coalesce(public_note, false) then
      raise exception 'This request ID belongs to a different score.';
    end if;
    return receipt;
  end if;

  if original is not null then
    if source.created_at + interval '10 seconds' < clock_timestamp() then
      raise exception 'The undo window has ended. Use Correct a score.';
    end if;
    if exists (select 1 from public.point_events where reverses_event_id = original) then
      raise exception 'This penalty has already been undone.';
    end if;
  end if;
  if target is null or delta is null or delta = 0 or delta not between -999 and 999
    or (kind = 'penalty' and delta < 0) then
    raise exception 'Enter a valid whole number of points.';
  end if;
  if char_length(clean_note) not between 3 and 180 then
    raise exception 'A reason must contain 3 to 180 characters.';
  end if;

  select points_total into prior_balance from public.players where id = target and active for update;
  if not found then raise exception 'This player is no longer active.'; end if;
  if prior_balance + delta < 0 then raise exception 'A correction cannot make the total negative.'; end if;

  select event_hash into receipt.previous_hash from public.point_events order by event_number desc limit 1;
  receipt.previous_hash := coalesce(receipt.previous_hash, 'GENESIS-LUDO-SUPER-LEAGUE-2026');
  receipt.event_number := nextval(pg_get_serial_sequence('public.point_events', 'event_number'));
  receipt.player_id := target;
  receipt.points := delta;
  receipt.reason := clean_note;
  receipt.consent := true;
  receipt.created_by := actor;
  receipt.created_at := clock_timestamp();
  receipt.event_type := kind;
  receipt.request_id := request_key;
  receipt.reverses_event_id := original;
  receipt.published_reason := coalesce(public_note, false);
  receipt.event_hash := scorebook_private.record_hash(receipt);

  update public.players set points_total = points_total + delta where id = target;
  insert into public.point_events (event_number, player_id, points, reason, consent, previous_hash,
    event_hash, created_by, created_at, event_type, request_id, reverses_event_id, published_reason)
  values (receipt.event_number, target, delta, clean_note, true, receipt.previous_hash,
    receipt.event_hash, actor, receipt.created_at, kind, request_key, original, receipt.published_reason)
  returning * into receipt;
  return receipt;
end;
$$;
revoke all on function scorebook_private.write_score(uuid,integer,text,boolean,uuid,boolean,text,uuid) from public, anon, authenticated;
grant execute on function scorebook_private.write_score(uuid,integer,text,boolean,uuid,boolean,text,uuid) to authenticated;

create function public.write_scorebook_entry(
  target uuid, delta integer, note text, witnessed boolean, request_key uuid,
  public_note boolean, kind text, original uuid default null
)
returns public.point_events language sql security invoker set search_path = ''
as $$ select scorebook_private.write_score(target, delta, note, witnessed, request_key, public_note, kind, original) $$;
revoke all on function public.write_scorebook_entry(uuid,integer,text,boolean,uuid,boolean,text,uuid) from public, anon, authenticated;
grant execute on function public.write_scorebook_entry(uuid,integer,text,boolean,uuid,boolean,text,uuid) to authenticated;

create function scorebook_private.verify()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  receipt public.point_events;
  expected text;
  broken bigint;
  signed_count integer := 0;
  older_count integer := 0;
  unsigned_count integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Sign in as an approved scorekeeper.' using errcode = '42501';
  end if;
  for receipt in select * from public.point_events order by event_number loop
    if coalesce(receipt.event_hash, '') !~ '^[0-9a-f]{64}$' then
      if receipt.request_id is not null then broken := coalesce(broken, receipt.event_number); end if;
      unsigned_count := unsigned_count + 1;
      expected := null;
      continue;
    end if;
    signed_count := signed_count + 1;
    if receipt.request_id is null then older_count := older_count + 1; end if;
    if (expected is not null and receipt.previous_hash is distinct from expected)
      or receipt.event_hash is distinct from scorebook_private.record_hash(receipt) then
      broken := coalesce(broken, receipt.event_number);
    end if;
    expected := receipt.event_hash;
  end loop;
  return jsonb_build_object('valid', broken is null, 'first_invalid', broken,
    'signed', signed_count, 'legacy', older_count, 'unsigned', unsigned_count);
end;
$$;
revoke all on function scorebook_private.verify() from public, anon, authenticated;
grant execute on function scorebook_private.verify() to authenticated;

create function public.verify_scorebook_chain()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select scorebook_private.verify() $$;
revoke all on function public.verify_scorebook_chain() from public, anon, authenticated;
grant execute on function public.verify_scorebook_chain() to authenticated;

notify pgrst, 'reload schema';
