-- 0017_registration_player_dedup.sql — odobrenje prijave ne smije duplicirati
-- igrača samo zato što mu se broj dresa razlikuje od ranijeg ručnog unosa.
--
-- Postojeće migracije se ne mijenjaju. Ovdje ponovno definiramo atomsku
-- funkciju iz 0011: igrača spajamo po normaliziranom imenu, broj iz prijave
-- ažurira postojeći red, a kontakt predstavnika osvježava se i na ranije
-- napravljenoj ekipi.

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
  v_player record;
  v_existing_player_id uuid;
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
  else
    update public.team
    set rep_email = lower(trim(v_registration.rep_email))
    where id = v_team_id;
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_player_sort_start
  from public.player
  where team_id = v_team_id;

  for v_player in
    select
      trim(item.value->>'name') as player_name,
      case
        when item.value->>'number' is null or item.value->>'number' = '' then null
        else (item.value->>'number')::integer
      end as shirt_number
    from jsonb_array_elements(coalesce(v_registration.players, '[]'::jsonb))
         with ordinality as item(value, ordinality)
    where length(trim(coalesce(item.value->>'name', ''))) > 0
    order by item.ordinality
  loop
    select p.id into v_existing_player_id
    from public.player p
    where p.team_id = v_team_id
      and lower(trim(p.name)) = lower(v_player.player_name)
    order by p.sort_order, p.id
    limit 1;

    if v_existing_player_id is not null then
      if v_player.shirt_number is not null then
        update public.player
        set number = v_player.shirt_number
        where id = v_existing_player_id;
      end if;
    else
      insert into public.player (team_id, name, number, sort_order)
      values (v_team_id, v_player.player_name, v_player.shirt_number, v_player_sort_start);
      v_player_sort_start := v_player_sort_start + 1;
    end if;
  end loop;

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

comment on function public.approve_registration is
  'Atomski odobrava prijavu; postojece igrace spaja po imenu i osvjezava broj dresa.';
