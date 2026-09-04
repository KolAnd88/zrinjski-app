-- 0030_registration_caps.sql — ograničen broj ekipa po konkurenciji + lista čekanja.
--
-- Turnir se igra na jednom terenu, pa broj ekipa nije želja nego granica koju
-- diktira satnica. Kad se konkurencija popuni, prijava se ne odbija — zaprima
-- se na listu čekanja, jer ekipe odustaju i mjesta se otvaraju.
--
-- Provjera je OVDJE, a ne u obrascu. Obrazac se može zaobići; funkcija je
-- security definer i jedini put do tablice `registration` za anonimnog
-- korisnika.
--
-- TRAŽI da je 0029 već pokrenut (dodaje vrijednost 'waitlist' u enum).

-- ── Granice ────────────────────────────────────────────────────────────────
-- NULL = bez ograničenja, kao i dosad. Odvojeno po konkurenciji jer muška i
-- ženska ne dijele mjesta.
alter table public.tournament
  add column if not exists max_teams_m integer,
  add column if not exists max_teams_z integer;

comment on column public.tournament.max_teams_m is
  'Najviše ekipa u muškoj konkurenciji. NULL = bez ograničenja.';
comment on column public.tournament.max_teams_z is
  'Najviše ekipa u ženskoj konkurenciji. NULL = bez ograničenja.';

-- ── Koliko je mjesta ───────────────────────────────────────────────────────
--
-- Zauzeto = ekipe koje su već u turniru + prijave koje čekaju odluku.
-- Prijave se broje namjerno: klub koji ispuni cijeli sastav ne smije na kraju
-- doznati da mjesta nema. Odbijanje prijave mjesto oslobađa ODMAH, jer se
-- ovdje ništa ne pamti — broji se u trenutku pitanja.
--
-- Odobrene prijave se NE broje zasebno: njih već predstavlja redak u `team`.
create or replace function public.registration_slots(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with granice as (
    select max_teams_m, max_teams_z
    from public.tournament
    where id = p_tournament_id
  ),
  brojevi as (
    select
      g::public.gender as gender,
      (select count(*) from public.team t
        where t.tournament_id = p_tournament_id and t.gender = g::public.gender)
      + (select count(*) from public.registration r
          where r.tournament_id = p_tournament_id
            and r.gender = g::public.gender
            and r.status = 'pending') as zauzeto,
      (select count(*) from public.registration r
        where r.tournament_id = p_tournament_id
          and r.gender = g::public.gender
          and r.status = 'waitlist') as ceka
    from unnest(array['m', 'z']) as g
  )
  select jsonb_object_agg(
    b.gender::text,
    jsonb_build_object(
      'cap', case when b.gender = 'm' then gr.max_teams_m else gr.max_teams_z end,
      'taken', b.zauzeto,
      'waiting', b.ceka,
      'free', case
        when (case when b.gender = 'm' then gr.max_teams_m else gr.max_teams_z end) is null then null
        else greatest(0, (case when b.gender = 'm' then gr.max_teams_m else gr.max_teams_z end) - b.zauzeto)
      end
    )
  )
  from brojevi b cross join granice gr;
$$;

revoke all on function public.registration_slots(uuid) from public;
grant execute on function public.registration_slots(uuid) to anon, authenticated;

-- ── Prijava ────────────────────────────────────────────────────────────────
--
-- Vraća jsonb umjesto samog id-a, jer prijavitelj mora saznati je li ušao
-- normalno ili na listu čekanja i koji je po redu. Zbog promjene povratnog
-- tipa stara se funkcija mora obrisati — `create or replace` to ne može.
drop function if exists public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb);

create function public.submit_registration(
  p_tournament_id uuid,
  p_team_name text,
  p_gender public.gender,
  p_rep_name text,
  p_rep_email text,
  p_player_count integer default null,
  p_players jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
  v_open boolean;
  v_deadline timestamptz;
  v_cap integer;
  v_taken integer;
  v_status public.registration_status;
  v_position integer;
  v_team_name text := trim(coalesce(p_team_name, ''));
  v_rep_name text := trim(coalesce(p_rep_name, ''));
  v_rep_email text := lower(trim(coalesce(p_rep_email, '')));
  v_players jsonb := coalesce(p_players, '[]'::jsonb);
  v_roster_count integer;
begin
  select registration_open, registration_deadline,
         case when p_gender = 'm' then max_teams_m else max_teams_z end
    into v_open, v_deadline, v_cap
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
         and roster_item.value->>'number' is not null
         and (
           (roster_item.value->>'number') !~ '^[0-9]+$'
           or (roster_item.value->>'number')::integer < 0
           or (roster_item.value->>'number')::integer > 99
         )
       )
  ) then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;

  if p_player_count is not null and (p_player_count < 0 or p_player_count > 40) then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;

  -- 'waitlist' je na popisu: ista ekipa ne smije jednom čekati, a drugi put
  -- biti u redu za odluku.
  if exists (
    select 1
    from public.registration r
    where r.tournament_id = p_tournament_id
      and r.gender = p_gender
      and lower(trim(r.team_name)) = lower(v_team_name)
      and r.status in ('pending', 'approved', 'waitlist')
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

  -- Popunjenost se računa tek ovdje, nakon svih provjera sadržaja: neispravna
  -- prijava ne smije zauzeti mjesto ni na trenutak.
  v_status := 'pending';
  if v_cap is not null then
    select
      (select count(*) from public.team t
        where t.tournament_id = p_tournament_id and t.gender = p_gender)
      + (select count(*) from public.registration r
          where r.tournament_id = p_tournament_id
            and r.gender = p_gender
            and r.status = 'pending')
    into v_taken;

    if v_taken >= v_cap then
      v_status := 'waitlist';
    end if;
  end if;

  v_roster_count := jsonb_array_length(v_players);

  insert into public.registration (
    tournament_id, team_name, gender, rep_name, rep_email,
    player_count, players, status
  ) values (
    p_tournament_id, v_team_name, p_gender, v_rep_name, v_rep_email,
    case when v_roster_count > 0 then v_roster_count else p_player_count end,
    v_players, v_status
  )
  returning id into v_registration_id;

  -- Mjesto u redu čekanja: koliko ih je stiglo prije, plus jedan.
  if v_status = 'waitlist' then
    select count(*) + 1 into v_position
    from public.registration r
    where r.tournament_id = p_tournament_id
      and r.gender = p_gender
      and r.status = 'waitlist'
      and r.id <> v_registration_id
      and r.created_at < (select created_at from public.registration where id = v_registration_id);
  end if;

  return jsonb_build_object(
    'id', v_registration_id,
    'status', v_status::text,
    'position', v_position
  );
end;
$$;

revoke all on function public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb) from public;
grant execute on function public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb) to anon, authenticated;

-- ── Prebacivanje s liste čekanja ───────────────────────────────────────────
--
-- Namjerno RUČNO. Između prijave i oslobođenog mjesta prođu tjedni, pa klub
-- treba potvrditi da još želi igrati — automatsko ubacivanje bi ga uvuklo u
-- turnir bez pitanja.
create or replace function public.waitlist_to_pending(p_registration_id uuid)
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

  if v_status <> 'waitlist' then
    raise exception using errcode = 'P0001', message = 'registration_not_waitlisted';
  end if;

  -- Samo u red za odluku, ne izravno u turnir: odobrenje ostaje zaseban korak
  -- s vlastitim stvaranjem ekipe i prepisivanjem sastava.
  update public.registration
  set status = 'pending'
  where id = p_registration_id;
end;
$$;

revoke all on function public.waitlist_to_pending(uuid) from public;
grant execute on function public.waitlist_to_pending(uuid) to authenticated;
