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
