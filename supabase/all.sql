-- all.sql — KOMPLETNA shema za prvo postavljanje VHMRK Zrinjski Cup baze.
-- Zalijepi CIJELI sadržaj u Supabase → SQL Editor → New query → Run.
-- Sadrži: shemu + RLS + realtime + storage + početni turnir.

-- ============================================================ 0001 SHEMA
-- 0001_schema.sql — VHMRK Zrinjski Cup
-- Shema baze prema baza.md. Jedan turnir, više dana; `gender` razdvaja M/Ž konkurenciju.
-- Imena u snake_case. Naziv "group" je rezerviran → grupa je tablica "grp".

-- ──────────────────────────────────────────────────────────────────────────
-- Enumi
-- ──────────────────────────────────────────────────────────────────────────
create type gender              as enum ('m', 'z');
create type stage               as enum ('group', 'semifinal', 'third_place', 'final');
create type match_status        as enum ('scheduled', 'live', 'finished');
create type event_type          as enum ('goal', 'save', 'red_card', 'suspension_2min');
create type sponsor_tier        as enum ('gold', 'silver', 'bronze', 'partner');
create type location_type       as enum ('hall', 'tent', 'dinner', 'hotel', 'other');
create type registration_status as enum ('pending', 'approved', 'rejected');
create type notification_type   as enum (
  'team_playing_soon', 'team_goal', 'match_end', 'schedule_change', 'program'
);

-- ──────────────────────────────────────────────────────────────────────────
-- Pomoćni trigger: updated_at
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- tournament — jedinstvene postavke turnira (jedan red za sad)
-- ──────────────────────────────────────────────────────────────────────────
create table public.tournament (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  season_year        int  not null,
  match_duration_min int  not null default 15,   -- trajanje utakmice (konfigurabilno)
  gap_min            int  not null default 5,    -- razmak između utakmica
  points_win         int  not null default 2,
  points_draw        int  not null default 1,
  points_loss        int  not null default 0,
  advance_per_group  int  not null default 2,    -- koliko prolazi iz grupe
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_tournament_updated
  before update on public.tournament
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- day — DANI TURNIRA (dodaju se preko kalendara)
-- ──────────────────────────────────────────────────────────────────────────
create table public.day (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournament(id) on delete cascade,
  date            date not null,
  first_match_time time,                          -- null = samo program/druženje
  sort_order      int  not null default 0
);
create index idx_day_tournament on public.day(tournament_id, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- grp — grupa
-- ──────────────────────────────────────────────────────────────────────────
create table public.grp (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid   not null references public.tournament(id) on delete cascade,
  gender        gender not null,
  name          text   not null,                  -- "Grupa A"
  sort_order    int    not null default 0
);
create index idx_grp_tournament on public.grp(tournament_id, gender, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- team
-- ──────────────────────────────────────────────────────────────────────────
create table public.team (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid   not null references public.tournament(id) on delete cascade,
  name          text   not null,
  short_code    text,                             -- 3 slova za grb (ZRI, GRU…)
  color         text,                             -- hex boje ekipe
  gender        gender not null,
  group_id      uuid references public.grp(id) on delete set null,
  coach_name    text,
  rep_email     text,
  logo_url      text,
  created_at    timestamptz not null default now()
);
create index idx_team_tournament on public.team(tournament_id, gender);
create index idx_team_group on public.team(group_id);

-- ──────────────────────────────────────────────────────────────────────────
-- player
-- ──────────────────────────────────────────────────────────────────────────
create table public.player (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.team(id) on delete cascade,
  number     int,
  name       text not null,
  is_captain boolean not null default false,
  sort_order int  not null default 0
);
create index idx_player_team on public.player(team_id, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- match
-- ──────────────────────────────────────────────────────────────────────────
create table public.match (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid   not null references public.tournament(id) on delete cascade,
  day_id           uuid references public.day(id) on delete set null,
  gender           gender not null,
  stage            stage  not null default 'group',
  grp_id           uuid references public.grp(id) on delete set null,
  home_team_id     uuid references public.team(id) on delete set null,
  away_team_id     uuid references public.team(id) on delete set null,
  home_placeholder text,                           -- npr. "Pobjednik PF1"
  away_placeholder text,
  home_score       int not null default 0,
  away_score       int not null default 0,
  scheduled_time   timestamptz,                    -- iz auto-satnice; uredivo
  status           match_status not null default 'scheduled',
  sort_order       int not null default 0,         -- redoslijed igranja
  best_player_id   uuid references public.player(id) on delete set null,
  current_minute   int,
  current_half     int
);
create index idx_match_tournament on public.match(tournament_id, gender);
create index idx_match_day on public.match(day_id, sort_order);
create index idx_match_grp on public.match(grp_id);
create index idx_match_status on public.match(status);

-- ──────────────────────────────────────────────────────────────────────────
-- match_event — tijek uživo; iz ovoga se agregira statistika
-- ──────────────────────────────────────────────────────────────────────────
create table public.match_event (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.match(id) on delete cascade,
  team_id    uuid not null references public.team(id) on delete cascade,
  player_id  uuid references public.player(id) on delete set null,
  type       event_type not null,
  minute     int not null,
  created_at timestamptz not null default now()
);
create index idx_event_match on public.match_event(match_id, created_at);
create index idx_event_player on public.match_event(player_id, type);

-- Gol → automatski podiže rezultat odgovarajuće ekipe na match.
-- Brisanje gol-eventa (npr. "poništi zadnje") → spušta rezultat.
-- Ručna korekcija rezultata = direktni UPDATE match.home_score/away_score (admin override).
create or replace function public.apply_goal_to_score()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new.type = 'goal') then
    update public.match
      set home_score = home_score + (case when new.team_id = home_team_id then 1 else 0 end),
          away_score = away_score + (case when new.team_id = away_team_id then 1 else 0 end)
      where id = new.match_id;
  elsif (tg_op = 'DELETE' and old.type = 'goal') then
    update public.match
      set home_score = greatest(0, home_score - (case when old.team_id = home_team_id then 1 else 0 end)),
          away_score = greatest(0, away_score - (case when old.team_id = away_team_id then 1 else 0 end))
      where id = old.match_id;
  end if;
  return null;
end;
$$;
create trigger trg_event_goal_insert
  after insert on public.match_event
  for each row execute function public.apply_goal_to_score();
create trigger trg_event_goal_delete
  after delete on public.match_event
  for each row execute function public.apply_goal_to_score();

-- ──────────────────────────────────────────────────────────────────────────
-- sponsor
-- ──────────────────────────────────────────────────────────────────────────
create table public.sponsor (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  name          text not null,
  tier          sponsor_tier not null,
  logo_url      text,
  is_active     boolean not null default true,    -- prekidač (npr. prikaz zlatnog)
  sort_order    int not null default 0
);
create index idx_sponsor_tournament on public.sponsor(tournament_id, tier, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- location
-- ──────────────────────────────────────────────────────────────────────────
create table public.location (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  type          location_type not null,
  name          text not null,
  description   text,
  lat           double precision,
  lng           double precision,                 -- za "Karta" → deep-link navigacija
  sort_order    int not null default 0
);
create index idx_location_tournament on public.location(tournament_id, type, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- program_item — društveni program (večere, dodjela, druženje)
-- ──────────────────────────────────────────────────────────────────────────
create table public.program_item (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  day_id        uuid not null references public.day(id) on delete cascade,
  time          time not null,
  title         text not null,
  location_id   uuid references public.location(id) on delete set null,
  sort_order    int not null default 0
);
create index idx_program_day on public.program_item(day_id, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- registration — prijave ekipa na odobravanje
-- ──────────────────────────────────────────────────────────────────────────
create table public.registration (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  team_name     text not null,
  gender        gender not null,
  rep_name      text not null,
  rep_email     text not null,
  player_count  int,
  status        registration_status not null default 'pending',
  created_at    timestamptz not null default now()
);
create index idx_registration_tournament on public.registration(tournament_id, status);

-- ──────────────────────────────────────────────────────────────────────────
-- gallery_photo
-- ──────────────────────────────────────────────────────────────────────────
create table public.gallery_photo (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  day_id        uuid references public.day(id) on delete set null,
  storage_path  text not null,                    -- Supabase Storage
  created_at    timestamptz not null default now()
);
create index idx_gallery_tournament on public.gallery_photo(tournament_id, day_id);

-- ──────────────────────────────────────────────────────────────────────────
-- app_user — admin/delegat/predstavnik (gledatelji ne trebaju račun)
-- id = auth.users.id
-- ──────────────────────────────────────────────────────────────────────────
create table public.app_user (
  id      uuid primary key references auth.users(id) on delete cascade,
  email   text not null,
  role    text not null default 'rep' check (role in ('admin', 'delegate', 'rep')),
  team_id uuid references public.team(id) on delete set null
);
create index idx_app_user_team on public.app_user(team_id);

-- ──────────────────────────────────────────────────────────────────────────
-- notification_log
-- ──────────────────────────────────────────────────────────────────────────
create table public.notification_log (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  type          notification_type not null,
  audience      text not null,                    -- 'all' | 'team:<id>' | 'followers:<team_id>'
  title         text not null,
  body          text,
  sent_at       timestamptz not null default now()
);
create index idx_notif_tournament on public.notification_log(tournament_id, sent_at);

-- ──────────────────────────────────────────────────────────────────────────
-- device — za push + preferencije obavijesti (anon uređaji gledatelja)
-- ──────────────────────────────────────────────────────────────────────────
create table public.device (
  id               uuid primary key default gen_random_uuid(),
  expo_push_token  text unique,
  language         text not null default 'hr',
  followed_team_ids uuid[] not null default '{}',
  prefs            jsonb not null default
                     '{"team_playing_soon":true,"team_goal":true,"match_end":true,"schedule_change":true,"program":false}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_device_updated
  before update on public.device
  for each row execute function public.set_updated_at();

-- ============================================================ 0002 RLS
-- 0002_rls.sql — Row Level Security politike
--
-- Smjernice (baza.md):
--  • Javno čitanje (anon): tournament, day, team, grp, player, match, match_event,
--    sponsor, location, program_item, gallery_photo. Gledatelji bez logina vide sve.
--  • Pisanje: samo app_user role admin/delegate. rep smije uređivati samo svoju ekipu/igrače.
--  • registration: anon INSERT (prijava); čitanje/odobravanje samo admin.
--  • device: anon upsert vlastitog reda; bez čitanja tuđih.
--  • notification_log: čitanje admin; pisanje admin/servis.

-- ──────────────────────────────────────────────────────────────────────────
-- Pomoćne funkcije (security definer — čitaju app_user bez RLS petlje)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_user
    where id = auth.uid() and role in ('admin', 'delegate')
  );
$$;

create or replace function public.is_rep_of_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_user
    where id = auth.uid() and role = 'rep' and team_id = p_team_id
  );
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Uključi RLS na sve tablice
-- ──────────────────────────────────────────────────────────────────────────
alter table public.tournament       enable row level security;
alter table public.day              enable row level security;
alter table public.grp              enable row level security;
alter table public.team             enable row level security;
alter table public.player           enable row level security;
alter table public.match            enable row level security;
alter table public.match_event      enable row level security;
alter table public.sponsor          enable row level security;
alter table public.location         enable row level security;
alter table public.program_item     enable row level security;
alter table public.registration     enable row level security;
alter table public.gallery_photo    enable row level security;
alter table public.app_user         enable row level security;
alter table public.notification_log enable row level security;
alter table public.device           enable row level security;

-- ──────────────────────────────────────────────────────────────────────────
-- Javno čitanje + admin/delegate puno pisanje
-- (read politika vrijedi za anon i authenticated; admin politika dodaje write)
-- ──────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tournament','day','grp','player','match','match_event',
    'sponsor','location','program_item','gallery_photo'
  ]
  loop
    execute format('create policy %I on public.%I for select using (true);',
                   t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());',
                   t || '_admin_write', t);
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- team — javno čitanje, admin puno, rep smije UPDATE samo svoju ekipu
-- ──────────────────────────────────────────────────────────────────────────
create policy team_read on public.team
  for select using (true);
create policy team_admin_write on public.team
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_rep_update on public.team
  for update to authenticated
  using (public.is_rep_of_team(id))
  with check (public.is_rep_of_team(id));

-- player rep politika (čitanje + admin već gore u petlji): rep upravlja igračima svoje ekipe
create policy player_rep_write on public.player
  for all to authenticated
  using (public.is_rep_of_team(team_id))
  with check (public.is_rep_of_team(team_id));

-- ──────────────────────────────────────────────────────────────────────────
-- registration — anon smije INSERT (prijava); samo admin čita / mijenja status
-- ──────────────────────────────────────────────────────────────────────────
create policy registration_insert on public.registration
  for insert to anon, authenticated with check (true);
create policy registration_admin_read on public.registration
  for select to authenticated using (public.is_admin());
create policy registration_admin_update on public.registration
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy registration_admin_delete on public.registration
  for delete to authenticated using (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- device — anon upsert (insert + update). NAPOMENA: bez per-uređaj tokena RLS ne
-- može u potpunosti spriječiti izmjenu tuđeg reda; za strogu izolaciju koristi
-- edge funkciju s tajnom uređaja. Čitanje tuđih redova je zabranjeno.
-- ──────────────────────────────────────────────────────────────────────────
create policy device_insert on public.device
  for insert to anon, authenticated with check (true);
create policy device_update on public.device
  for update to anon, authenticated using (true) with check (true);
-- (namjerno BEZ select politike za anon → tablica nije javno čitljiva)
create policy device_admin_read on public.device
  for select to authenticated using (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- app_user — korisnik čita/uređuje svoj red; admin sve
-- ──────────────────────────────────────────────────────────────────────────
create policy app_user_self_read on public.app_user
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy app_user_admin_write on public.app_user
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- notification_log — admin čita i piše (servis koristi service_role koji zaobilazi RLS)
-- ──────────────────────────────────────────────────────────────────────────
create policy notif_admin_read on public.notification_log
  for select to authenticated using (public.is_admin());
create policy notif_admin_write on public.notification_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================ 0003 REALTIME
-- 0003_realtime.sql — Realtime publikacija
-- Uživo rezultat i tijek moraju se vidjeti odmah na korisničkim uređajima.
-- match + match_event obavezno; sponsor + program_item korisno (rjeđe mijene).

alter publication supabase_realtime add table public.match;
alter publication supabase_realtime add table public.match_event;
alter publication supabase_realtime add table public.sponsor;
alter publication supabase_realtime add table public.program_item;

-- Za REPLICA IDENTITY FULL (da DELETE/UPDATE eventi nose stare vrijednosti u realtime):
alter table public.match        replica identity full;
alter table public.match_event  replica identity full;

-- ============================================================ 0004 STORAGE
-- 0004_storage.sql — Storage bucket za javne medije (logotipi sponzora/ekipa).
-- Javno čitanje (gledatelji vide logotipe); pisanje samo admin/delegate.

insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

-- Javno čitanje objekata iz bucketa.
create policy "public_assets_read"
  on storage.objects for select
  using (bucket_id = 'public-assets');

-- Upload / izmjena / brisanje: samo admin/delegate (preko is_admin()).
create policy "public_assets_admin_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

-- ============================================================ 0005 OBAVIJESTI
-- 0005_notifications.sql — podrška za ručne obavijesti i automatske podsjetnike.

-- Ručno poslane obavijesti (admin upiše tekst) ne pripadaju automatskim tipovima.
alter type notification_type add value if not exists 'custom';

-- Postavke automatskih podsjetnika (prekidači na ekranu Obavijesti).
alter table public.tournament
  add column if not exists reminder_prefs jsonb not null default
    '{"day_before_18":true,"thirty_min_before":true,"schedule_change":true}'::jsonb;

-- ============================================================ SEED (početni turnir)
-- seed.sql — minimalni početni podaci (jedan turnir)
-- Pokreće se kod `supabase db reset`. Sve ostalo se unosi kroz admin.

insert into public.tournament (name, season_year, match_duration_min, gap_min)
values ('VHMRK Zrinjski Cup', 2026, 15, 5)
on conflict do nothing;
