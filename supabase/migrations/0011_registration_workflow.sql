-- 0011_registration_workflow.sql — sigurne javne prijave i atomsko odobravanje.
--
-- Javni obrazac više ne piše izravno u tablicu. Security-definer RPC provjerava
-- je li prijava otvorena, rok, sadržaj, duplikate i osnovni limit slanja.
-- Odobravanje u jednoj transakciji kreira/pronalazi ekipu, prenosi igrače i
-- označava prijavu obrađenom, pa ponovljeni klik ne može napraviti duplikat.

alter table public.tournament
  add column if not exists registration_open boolean not null default true,
  add column if not exists registration_deadline timestamptz;

alter table public.registration
  add column if not exists approved_team_id uuid references public.team(id) on delete set null,
  add column if not exists processed_at timestamptz,
  add column if not exists processed_by uuid references auth.users(id) on delete set null;

create index if not exists idx_registration_email_recent
  on public.registration (lower(rep_email), created_at desc);

create or replace function public.submit_registration(
  p_tournament_id uuid,
  p_team_name text,
  p_gender public.gender,
  p_rep_name text,
  p_rep_email text,
  p_player_count integer default null,
  p_players jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
  v_open boolean;
  v_deadline timestamptz;
  v_team_name text := trim(coalesce(p_team_name, ''));
  v_rep_name text := trim(coalesce(p_rep_name, ''));
  v_rep_email text := lower(trim(coalesce(p_rep_email, '')));
  v_players jsonb := coalesce(p_players, '[]'::jsonb);
  v_roster_count integer;
begin
  select registration_open, registration_deadline
    into v_open, v_deadline
    from public.tournament
    where id = p_tournament_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'registration_unavailable';
  end if;

  if not v_open or (v_deadline is not null and now() > v_deadline) then
    raise exception using errcode = 'P0001', message = 'registration_closed';
  end if;

  if length(v_team_name) < 2 or length(v_team_name) > 120
     or length(v_rep_name) < 2 or length(v_rep_name) > 120
     or length(v_rep_email) > 254
     or v_rep_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;

  if jsonb_typeof(v_players) <> 'array' or jsonb_array_length(v_players) > 40 then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_players) as roster_item(value)
    where jsonb_typeof(roster_item.value) <> 'object'
       or length(trim(coalesce(roster_item.value->>'name', ''))) < 2
       or length(trim(coalesce(roster_item.value->>'name', ''))) > 120
       or (
         roster_item.value ? 'number'
         and jsonb_typeof(roster_item.value->'number') <> 'null'
         and case
           when jsonb_typeof(roster_item.value->'number') <> 'number' then true
           when coalesce(roster_item.value->>'number', '') !~ '^[0-9]{1,3}$' then true
           else (roster_item.value->>'number')::integer > 999
         end
       )
  ) then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;

  if p_player_count is not null and (p_player_count < 0 or p_player_count > 40) then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;

  if exists (
    select 1
    from public.registration r
    where r.tournament_id = p_tournament_id
      and r.gender = p_gender
      and lower(trim(r.team_name)) = lower(v_team_name)
      and r.status in ('pending', 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'registration_duplicate';
  end if;

  if (
    select count(*)
    from public.registration r
    where lower(r.rep_email) = v_rep_email
      and r.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'registration_rate_limited';
  end if;

  v_roster_count := jsonb_array_length(v_players);

  insert into public.registration (
    tournament_id,
    team_name,
    gender,
    rep_name,
    rep_email,
    player_count,
    players
  ) values (
    p_tournament_id,
    v_team_name,
    p_gender,
    v_rep_name,
    v_rep_email,
    case when v_roster_count > 0 then v_roster_count else p_player_count end,
    v_players
  )
  returning id into v_registration_id;

  return v_registration_id;
end;
$$;

revoke all on function public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb) from public;
grant execute on function public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb) to anon, authenticated;

create or replace function public.approve_registration(
  p_registration_id uuid,
  p_short_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registration%rowtype;
  v_team_id uuid;
  v_short_code text;
  v_sort_order integer;
  v_player_sort_start integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'insufficient_privilege';
  end if;

  select * into v_registration
  from public.registration
  where id = p_registration_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'registration_not_found';
  end if;

  if v_registration.status = 'approved' and v_registration.approved_team_id is not null then
    return v_registration.approved_team_id;
  end if;

  if v_registration.status = 'rejected' then
    raise exception using errcode = 'P0001', message = 'registration_already_rejected';
  end if;

  -- Ako je stariji, prekinuti pokušaj već kreirao ekipu, ponovno je koristimo.
  select id into v_team_id
  from public.team
  where tournament_id = v_registration.tournament_id
    and gender = v_registration.gender
    and lower(trim(name)) = lower(trim(v_registration.team_name))
  order by created_at
  limit 1;

  if v_team_id is null then
    select coalesce(max(sort_order), -1) + 1 into v_sort_order
    from public.team
    where tournament_id = v_registration.tournament_id
      and gender = v_registration.gender;

    v_short_code := left(regexp_replace(upper(coalesce(p_short_code, '')), '[^A-Z0-9]', '', 'g'), 3);
    if length(v_short_code) < 2 then
      v_short_code := left(regexp_replace(upper(v_registration.team_name), '[^A-Z0-9]', '', 'g'), 3);
    end if;
    if length(v_short_code) < 2 then
      v_short_code := 'EKP';
    end if;

    insert into public.team (
      tournament_id, name, short_code, gender, rep_email, sort_order
    ) values (
      v_registration.tournament_id,
      trim(v_registration.team_name),
      v_short_code,
      v_registration.gender,
      lower(trim(v_registration.rep_email)),
      v_sort_order
    )
    returning id into v_team_id;
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_player_sort_start
  from public.player
  where team_id = v_team_id;

  insert into public.player (team_id, name, number, sort_order)
  select
    v_team_id,
    trim(item.value->>'name'),
    case
      when item.value->>'number' is null or item.value->>'number' = '' then null
      else (item.value->>'number')::integer
    end,
    v_player_sort_start + item.ordinality::integer - 1
  from jsonb_array_elements(coalesce(v_registration.players, '[]'::jsonb))
       with ordinality as item(value, ordinality)
  where length(trim(coalesce(item.value->>'name', ''))) > 0
    and not exists (
      select 1
      from public.player p
      where p.team_id = v_team_id
        and lower(trim(p.name)) = lower(trim(item.value->>'name'))
        and p.number is not distinct from case
          when item.value->>'number' is null or item.value->>'number' = '' then null
          else (item.value->>'number')::integer
        end
    );

  update public.registration
  set status = 'approved',
      approved_team_id = v_team_id,
      processed_at = now(),
      processed_by = auth.uid()
  where id = p_registration_id;

  return v_team_id;
end;
$$;

revoke all on function public.approve_registration(uuid, text) from public;
grant execute on function public.approve_registration(uuid, text) to authenticated;

create or replace function public.reject_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.registration_status;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'insufficient_privilege';
  end if;

  select status into v_status
  from public.registration
  where id = p_registration_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'registration_not_found';
  end if;

  if v_status = 'approved' then
    raise exception using errcode = 'P0001', message = 'registration_already_approved';
  end if;

  update public.registration
  set status = 'rejected',
      processed_at = now(),
      processed_by = auth.uid()
  where id = p_registration_id;
end;
$$;

revoke all on function public.reject_registration(uuid) from public;
grant execute on function public.reject_registration(uuid) to authenticated;

-- Čitanje prijava ostaje osoblju. Sve promjene idu kroz provjerene RPC funkcije.
drop policy if exists registration_insert on public.registration;
drop policy if exists registration_admin_update on public.registration;
drop policy if exists registration_admin_delete on public.registration;
revoke insert, update, delete on table public.registration from anon, authenticated;
