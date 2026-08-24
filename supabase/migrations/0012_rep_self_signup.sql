-- 0012_rep_self_signup.sql — predstavnik kluba sam otvara račun i sam prijavljuje ekipu.
--
-- Tok:
--   1. Registracija (Supabase Auth signUp) → okidač napravi app_user s ulogom 'rep'
--      i BEZ ekipe. Takav račun sam po sebi ne može ništa osim prijaviti ekipu.
--   2. Prijavi ekipu → red u `registration`, vezan uz auth.uid() preko created_by.
--   3. Dok čeka odobrenje, predstavnik uređuje NACRT sastava (registration.players).
--   4. Admin odobri → nastaje ekipa s igračima, a app_user.team_id se poveže,
--      pa isti ekran prelazi na uređivanje pravih igrača.
--
-- Ekipa se NE pojavljuje u turniru dok admin ne odobri — otvorena registracija
-- je zato bezopasna: račun bez odobrene ekipe nema što raditi.

-- ── Tko je poslao prijavu ──────────────────────────────────────────────────
alter table public.registration
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_registration_created_by
  on public.registration (created_by)
  where created_by is not null;

-- ── Profil za novi račun ───────────────────────────────────────────────────
-- NAMJERNO bez okidača na auth.users: tu tablicu u Supabaseu posjeduje
-- supabase_auth_admin, pa SQL Editor nema pravo postaviti okidač na nju
-- ("must be owner of relation users") i migracija bi stala na tom mjestu.
--
-- Umjesto toga profil stvara sama aplikacija, prvim pozivom nakon prijave.
-- Funkcija je idempotentna pa je svejedno koliko se puta pozove. Uloga je
-- uvijek 'rep' — admina i delegata i dalje radi isključivo admin.
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_uid is null then
    return;
  end if;
  insert into public.app_user (id, email, role, team_id)
  values (v_uid, v_email, 'rep', null)
  on conflict (id) do nothing;
end;
$$;

-- ── Predstavnik prijavljuje svoju ekipu ────────────────────────────────────
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
  v_uid   uuid := auth.uid();
  v_email text;
  v_t     public.tournament;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'registration_unauthorized';
  end if;
  if coalesce(trim(p_team_name), '') = '' then
    raise exception 'registration_invalid';
  end if;

  select * into v_t from public.tournament order by created_at limit 1;
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

  -- E-mail uzimamo iz tokena, ne iz auth.users — ta tablica nije naša.
  v_email := coalesce(auth.jwt() ->> 'email', '');

  insert into public.registration (
    tournament_id, team_name, gender, rep_name, rep_email, created_by, players
  ) values (
    v_t.id,
    trim(p_team_name),
    p_gender,
    coalesce(nullif(trim(p_rep_name), ''), split_part(v_email, '@', 1)),
    lower(trim(v_email)),
    v_uid,
    '[]'::jsonb
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Predstavnik uređuje nacrt sastava dok prijava čeka ─────────────────────
create or replace function public.update_my_registration_players(p_players jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'registration_unauthorized';
  end if;
  if jsonb_typeof(coalesce(p_players, '[]'::jsonb)) <> 'array' then
    raise exception 'registration_invalid';
  end if;

  -- Samo vlastita prijava, i samo dok još nije obrađena.
  update public.registration
  set players      = coalesce(p_players, '[]'::jsonb),
      player_count = jsonb_array_length(coalesce(p_players, '[]'::jsonb))
  where created_by = v_uid
    and status = 'pending';
end;
$$;

-- ── Čitanje vlastite prijave ───────────────────────────────────────────────
drop policy if exists registration_own_read on public.registration;
create policy registration_own_read
  on public.registration for select
  to authenticated
  using (created_by = auth.uid());

-- ── Dozvole ────────────────────────────────────────────────────────────────
revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

revoke all on function public.submit_my_registration(text, gender, text) from public;
grant execute on function public.submit_my_registration(text, gender, text) to authenticated;

revoke all on function public.update_my_registration_players(jsonb) from public;
grant execute on function public.update_my_registration_players(jsonb) to authenticated;

comment on function public.submit_my_registration is
  'Predstavnik prijavljuje svoju ekipu. Jedan racun = jedna prijava.';
comment on function public.update_my_registration_players is
  'Predstavnik ureduje nacrt sastava dok prijava ceka odobrenje.';

-- ── Odobrenje mora povezati račun predstavnika s ekipom ────────────────────
-- Bez ovoga bi predstavnik i nakon odobrenja ostao bez ekipe i ne bi mogao
-- uređivati igrače. Nadopunjuje approve_registration iz 0011.
create or replace function public.link_registration_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and new.approved_team_id is not null
     and new.created_by is not null then
    update public.app_user
    set team_id = new.approved_team_id,
        role    = case when role = 'rep' then 'rep' else role end
    where id = new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists on_registration_approved on public.registration;
create trigger on_registration_approved
  after update of status on public.registration
  for each row
  when (new.status = 'approved')
  execute function public.link_registration_owner();

comment on function public.link_registration_owner is
  'Kad je prijava odobrena, racun koji ju je poslao dobiva svoju ekipu.';
