-- 0034_caps_everywhere_and_safe_notify.sql — tri rupe iz pregleda koda.
--
-- 1. Granica broja ekipa vrijedila je samo za javni obrazac. Predstavnik s
--    računom prijavljivao se drugom funkcijom, koja granicu nije ni gledala.
-- 2. Dvije istodobne prijave mogle su obje zauzeti isto zadnje mjesto: obje
--    prebroje 11, obje upišu, ispadne 13.
-- 3. Okidač za obavijest nije hvatao greške. Komentar je tvrdio da "nikad ne
--    rusi prijavu", a nije bilo istina: greška u `net.http_post` ili pri
--    citanju Vaulta srusila bi cijelu transakciju i prijava kluba bi nestala.

/**
 * Koliko je mjesta zauzeto u konkurenciji.
 *
 * Izdvojeno jer isto pitanje sada postavljaju DVA ulaza — javni obrazac i
 * portal predstavnika. Dok je racunica stajala samo u jednom, drugi je
 * nastavio primati prijave preko granice.
 */
create or replace function public.taken_slots(p_tournament_id uuid, p_gender public.gender)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.team t
      where t.tournament_id = p_tournament_id and t.gender = p_gender)
    + (select count(*) from public.registration r
        where r.tournament_id = p_tournament_id
          and r.gender = p_gender
          and r.status = 'pending');
$$;

revoke all on function public.taken_slots(uuid, public.gender) from public;
grant execute on function public.taken_slots(uuid, public.gender) to anon, authenticated;

-- ── Prijava kroz portal predstavnika ───────────────────────────────────────
create or replace function public.submit_my_registration(
  p_team_name text,
  p_gender    gender,
  p_rep_name  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_t      public.tournament;
  v_id     uuid;
  v_cap    integer;
  v_status public.registration_status := 'pending';
begin
  if v_uid is null then
    raise exception 'registration_unauthorized';
  end if;
  if coalesce(trim(p_team_name), '') = '' then
    raise exception 'registration_invalid';
  end if;

  -- `for update` zakljucava redak turnira do kraja transakcije. Time se
  -- prebrojavanje mjesta i upis odvijaju kao jedna cjelina: druga prijava
  -- ceka, pa ne moze prebrojati isto stanje i zauzeti isto mjesto.
  select * into v_t from public.tournament order by created_at limit 1 for update;
  if v_t.id is null then
    raise exception 'registration_unavailable';
  end if;
  if not v_t.registration_open
     or (v_t.registration_deadline is not null and now() > v_t.registration_deadline) then
    raise exception 'registration_closed';
  end if;

  -- Jedan račun = jedna prijava. Ponovni poziv vraća postojeću umjesto duplikata.
  select id into v_id
  from public.registration
  where created_by = v_uid and status <> 'rejected'
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- Granica vrijedi i ovdje. Prije je vrijedila samo za javni obrazac, pa je
  -- predstavnik s racunom mogao usci i kad je konkurencija bila puna.
  v_cap := case when p_gender = 'm' then v_t.max_teams_m else v_t.max_teams_z end;
  if v_cap is not null and public.taken_slots(v_t.id, p_gender) >= v_cap then
    v_status := 'waitlist';
  end if;

  -- E-mail uzimamo iz tokena, ne iz auth.users — ta tablica nije naša.
  v_email := coalesce(auth.jwt() ->> 'email', '');

  insert into public.registration (
    tournament_id, team_name, gender, rep_name, rep_email, created_by, players, status
  ) values (
    v_t.id,
    trim(p_team_name),
    p_gender,
    coalesce(nullif(trim(p_rep_name), ''), split_part(v_email, '@', 1)),
    lower(trim(v_email)),
    v_uid,
    '[]'::jsonb,
    v_status
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_my_registration(text, gender, text) from public;
grant execute on function public.submit_my_registration(text, gender, text) to authenticated;

-- ── Javni obrazac: isto zakljucavanje ──────────────────────────────────────
--
-- Sadrzaj je isti kao u 0030; jedina razlika je `for update` na turniru i
-- koristenje zajednickog `taken_slots`, da obje staze racunaju isto.
create or replace function public.submit_registration(
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
  v_t public.tournament;
  v_cap integer;
  v_status public.registration_status;
  v_position integer;
  v_team_name text := trim(coalesce(p_team_name, ''));
  v_rep_name text := trim(coalesce(p_rep_name, ''));
  v_rep_email text := lower(trim(coalesce(p_rep_email, '')));
  v_players jsonb := coalesce(p_players, '[]'::jsonb);
  v_roster_count integer;
begin
  select * into v_t from public.tournament where id = p_tournament_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'registration_unavailable';
  end if;

  if not v_t.registration_open
     or (v_t.registration_deadline is not null and now() > v_t.registration_deadline) then
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

  v_status := 'pending';
  v_cap := case when p_gender = 'm' then v_t.max_teams_m else v_t.max_teams_z end;
  if v_cap is not null and public.taken_slots(p_tournament_id, p_gender) >= v_cap then
    v_status := 'waitlist';
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

-- ── Obavijest koja stvarno ne moze srusiti prijavu ─────────────────────────
create or replace function public.notify_new_registration()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_anon constant text :=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWRxZnhsdHdodm5nZnhramZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDkyNzgsImV4cCI6MjA5NzMyNTI3OH0.FcoKqxH-APXffBuBbyAdtO5qmfQrsCYuLFVHANrU7NA';
begin
  /**
   * SVE u bloku koji hvata greske.
   *
   * Prijasnja verzija je tvrdila da "nikad ne rusi prijavu", a nije imala
   * `exception` blok — pa bi greska u `net.http_post` ili pri citanju Vaulta
   * podigla iznimku, okidac bi je propustio dalje i cijela transakcija bi se
   * ponistila. Klub bi poslao prijavu, dobio gresku, a prijave ne bi bilo.
   *
   * Obavijest je pomocna radnja. Ako padne, pada samo ona.
   */
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'push_hook_secret';

    if v_secret is null then
      return new;
    end if;

    perform net.http_post(
      url := 'https://iymdqfxltwhvngfxkjfy.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon,
        'x-hook-secret', v_secret
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'registration',
        'record', to_jsonb(new)
      )
    );
  exception
    when others then
      -- Namjerno se ne dize dalje. Zapis u log da se ne izgubi tiho:
      -- vidljiv je u Supabase > Logs > Postgres.
      raise warning 'notify_new_registration: obavijest nije poslana (%)', sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.notify_new_registration is
  'Javi organizatoru da je stigla nova prijava. Greska u slanju NE rusi prijavu.';
