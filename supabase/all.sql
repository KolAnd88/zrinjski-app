-- all.sql — KOMPLETNA shema za VHMRK Zrinjski Cup (idempotentno).
-- Sigurno za VIŠEKRATNO pokretanje: ako nešto već postoji, preskače bez greške.
-- Zalijepi CIJELI sadržaj u Supabase → SQL Editor → New query → Run.

-- ════════════════════════════════════════════════════════════ ENUMI
do $$ begin create type gender as enum ('m','z'); exception when duplicate_object then null; end $$;
do $$ begin create type stage as enum ('group','semifinal','third_place','final'); exception when duplicate_object then null; end $$;
do $$ begin create type match_status as enum ('scheduled','live','finished'); exception when duplicate_object then null; end $$;
do $$ begin create type event_type as enum ('goal','save','red_card','suspension_2min'); exception when duplicate_object then null; end $$;
do $$ begin create type sponsor_tier as enum ('gold','silver','bronze','partner'); exception when duplicate_object then null; end $$;
do $$ begin create type location_type as enum ('hall','tent','dinner','hotel','other'); exception when duplicate_object then null; end $$;
do $$ begin create type registration_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type notification_type as enum ('team_playing_soon','team_goal','match_end','schedule_change','program','custom'); exception when duplicate_object then null; end $$;
-- ako tip postoji od ranije bez 'custom' — dodaj ga
alter type notification_type add value if not exists 'custom';

-- ════════════════════════════════════════════════════════════ FUNKCIJE
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.apply_goal_to_score()
returns trigger language plpgsql as $$
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
end; $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_user where id = auth.uid() and role in ('admin','delegate'));
$$;

create or replace function public.is_rep_of_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_user where id = auth.uid() and role = 'rep' and team_id = p_team_id);
$$;

-- ════════════════════════════════════════════════════════════ TABLICE
create table if not exists public.tournament (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season_year int not null,
  match_duration_min int not null default 15,
  gap_min int not null default 5,
  points_win int not null default 2,
  points_draw int not null default 1,
  points_loss int not null default 0,
  advance_per_group int not null default 2,
  reminder_prefs jsonb not null default '{"day_before_18":true,"thirty_min_before":true,"schedule_change":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tournament add column if not exists reminder_prefs jsonb not null default '{"day_before_18":true,"thirty_min_before":true,"schedule_change":true}'::jsonb;

create table if not exists public.day (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  date date not null,
  first_match_time time,
  sort_order int not null default 0
);
create index if not exists idx_day_tournament on public.day(tournament_id, sort_order);

create table if not exists public.grp (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  gender gender not null,
  name text not null,
  sort_order int not null default 0
);
create index if not exists idx_grp_tournament on public.grp(tournament_id, gender, sort_order);

create table if not exists public.team (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  name text not null,
  short_code text,
  color text,
  gender gender not null,
  group_id uuid references public.grp(id) on delete set null,
  coach_name text,
  rep_email text,
  logo_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- `color` se više ne koristi u UI-ju: boja grba = crestColorFor(sort_order).
alter table public.team add column if not exists sort_order int not null default 0;
create index if not exists idx_team_tournament on public.team(tournament_id, gender);
create index if not exists idx_team_group on public.team(group_id);
create index if not exists idx_team_sort on public.team(tournament_id, gender, sort_order);

create table if not exists public.player (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team(id) on delete cascade,
  number int,
  name text not null,
  is_captain boolean not null default false,
  sort_order int not null default 0
);
create index if not exists idx_player_team on public.player(team_id, sort_order);

create table if not exists public.match (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  day_id uuid references public.day(id) on delete set null,
  gender gender not null,
  stage stage not null default 'group',
  grp_id uuid references public.grp(id) on delete set null,
  home_team_id uuid references public.team(id) on delete set null,
  away_team_id uuid references public.team(id) on delete set null,
  home_placeholder text,
  away_placeholder text,
  home_score int not null default 0,
  away_score int not null default 0,
  scheduled_time timestamptz,
  status match_status not null default 'scheduled',
  sort_order int not null default 0,
  best_player_id uuid references public.player(id) on delete set null,
  current_minute int,
  current_half int
);
create index if not exists idx_match_tournament on public.match(tournament_id, gender);
create index if not exists idx_match_day on public.match(day_id, sort_order);
create index if not exists idx_match_grp on public.match(grp_id);
create index if not exists idx_match_status on public.match(status);

create table if not exists public.match_event (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  player_id uuid references public.player(id) on delete set null,
  type event_type not null,
  minute int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_event_match on public.match_event(match_id, created_at);
create index if not exists idx_event_player on public.match_event(player_id, type);

create table if not exists public.sponsor (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  name text not null,
  tier sponsor_tier not null,
  logo_url text,
  is_active boolean not null default true,
  sort_order int not null default 0
);
create index if not exists idx_sponsor_tournament on public.sponsor(tournament_id, tier, sort_order);

create table if not exists public.location (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  type location_type not null,
  name text not null,
  description text,
  lat double precision,
  lng double precision,
  sort_order int not null default 0
);
create index if not exists idx_location_tournament on public.location(tournament_id, type, sort_order);

create table if not exists public.program_item (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  day_id uuid not null references public.day(id) on delete cascade,
  time time not null,
  title text not null,
  location_id uuid references public.location(id) on delete set null,
  sort_order int not null default 0
);
create index if not exists idx_program_day on public.program_item(day_id, sort_order);

create table if not exists public.registration (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  team_name text not null,
  gender gender not null,
  rep_name text not null,
  rep_email text not null,
  player_count int,
  status registration_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_registration_tournament on public.registration(tournament_id, status);

create table if not exists public.gallery_photo (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  day_id uuid references public.day(id) on delete set null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_gallery_tournament on public.gallery_photo(tournament_id, day_id);

create table if not exists public.app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'rep' check (role in ('admin','delegate','rep')),
  team_id uuid references public.team(id) on delete set null
);
create index if not exists idx_app_user_team on public.app_user(team_id);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  type notification_type not null,
  audience text not null,
  title text not null,
  body text,
  sent_at timestamptz not null default now()
);
create index if not exists idx_notif_tournament on public.notification_log(tournament_id, sent_at);

create table if not exists public.device (
  id uuid primary key default gen_random_uuid(),
  expo_push_token text unique,
  language text not null default 'hr',
  followed_team_ids uuid[] not null default '{}',
  prefs jsonb not null default '{"team_playing_soon":true,"team_goal":true,"match_end":true,"schedule_change":true,"program":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════ TRIGGERI
drop trigger if exists trg_tournament_updated on public.tournament;
create trigger trg_tournament_updated before update on public.tournament
  for each row execute function public.set_updated_at();

drop trigger if exists trg_device_updated on public.device;
create trigger trg_device_updated before update on public.device
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_goal_insert on public.match_event;
create trigger trg_event_goal_insert after insert on public.match_event
  for each row execute function public.apply_goal_to_score();

drop trigger if exists trg_event_goal_delete on public.match_event;
create trigger trg_event_goal_delete after delete on public.match_event
  for each row execute function public.apply_goal_to_score();

-- ════════════════════════════════════════════════════════════ RLS
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

-- Javno čitanje + admin pisanje (idempotentno: prvo drop)
do $$
declare t text;
begin
  foreach t in array array['tournament','day','grp','player','match','match_event','sponsor','location','program_item','gallery_photo']
  loop
    execute format('drop policy if exists %I on public.%I;', t||'_read', t);
    execute format('create policy %I on public.%I for select using (true);', t||'_read', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t||'_admin_write', t);
  end loop;
end $$;

drop policy if exists team_read on public.team;
create policy team_read on public.team for select using (true);
drop policy if exists team_admin_write on public.team;
create policy team_admin_write on public.team for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists team_rep_update on public.team;
create policy team_rep_update on public.team for update to authenticated using (public.is_rep_of_team(id)) with check (public.is_rep_of_team(id));

drop policy if exists player_rep_write on public.player;
create policy player_rep_write on public.player for all to authenticated using (public.is_rep_of_team(team_id)) with check (public.is_rep_of_team(team_id));

drop policy if exists registration_insert on public.registration;
create policy registration_insert on public.registration for insert to anon, authenticated with check (true);
drop policy if exists registration_admin_read on public.registration;
create policy registration_admin_read on public.registration for select to authenticated using (public.is_admin());
drop policy if exists registration_admin_update on public.registration;
create policy registration_admin_update on public.registration for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists registration_admin_delete on public.registration;
create policy registration_admin_delete on public.registration for delete to authenticated using (public.is_admin());

drop policy if exists device_insert on public.device;
create policy device_insert on public.device for insert to anon, authenticated with check (true);
drop policy if exists device_update on public.device;
create policy device_update on public.device for update to anon, authenticated using (true) with check (true);
drop policy if exists device_admin_read on public.device;
create policy device_admin_read on public.device for select to authenticated using (public.is_admin());

drop policy if exists app_user_self_read on public.app_user;
create policy app_user_self_read on public.app_user for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists app_user_admin_write on public.app_user;
create policy app_user_admin_write on public.app_user for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists notif_admin_read on public.notification_log;
create policy notif_admin_read on public.notification_log for select to authenticated using (public.is_admin());
drop policy if exists notif_admin_write on public.notification_log;
create policy notif_admin_write on public.notification_log for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════ REALTIME
do $$ begin alter publication supabase_realtime add table public.match; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.match_event; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.sponsor; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.program_item; exception when duplicate_object then null; end $$;
alter table public.match replica identity full;
alter table public.match_event replica identity full;

-- ════════════════════════════════════════════════════════════ STORAGE
insert into storage.buckets (id, name, public) values ('public-assets','public-assets', true)
  on conflict (id) do nothing;
drop policy if exists public_assets_read on storage.objects;
create policy public_assets_read on storage.objects for select using (bucket_id = 'public-assets');
drop policy if exists public_assets_admin_write on storage.objects;
create policy public_assets_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

-- Logotipi ekipa (opcionalni; fallback je krug s kraticom).
insert into storage.buckets (id, name, public) values ('team-logos','team-logos', true)
  on conflict (id) do nothing;
drop policy if exists team_logos_read on storage.objects;
create policy team_logos_read on storage.objects for select using (bucket_id = 'team-logos');
drop policy if exists team_logos_admin_write on storage.objects;
create policy team_logos_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'team-logos' and public.is_admin())
  with check (bucket_id = 'team-logos' and public.is_admin());

-- ════════════════════════════════════════════════════════════ POČETNI TURNIR (samo ako ne postoji)
insert into public.tournament (name, season_year, match_duration_min, gap_min)
select 'VHMRK Zrinjski Cup', 2026, 15, 5
where not exists (select 1 from public.tournament);
