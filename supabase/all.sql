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
  registration_open boolean not null default true,
  registration_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tournament add column if not exists reminder_prefs jsonb not null default '{"day_before_18":true,"thirty_min_before":true,"schedule_change":true}'::jsonb;
alter table public.tournament add column if not exists registration_open boolean not null default true;
alter table public.tournament add column if not exists registration_deadline timestamptz;

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
  players jsonb not null default '[]'::jsonb,
  status registration_status not null default 'pending',
  approved_team_id uuid references public.team(id) on delete set null,
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Nacrt sastava iz javne prijave: [{name, number}]; kod odobrenja ide u `player`.
alter table public.registration add column if not exists players jsonb not null default '[]'::jsonb;
alter table public.registration add column if not exists approved_team_id uuid references public.team(id) on delete set null;
alter table public.registration add column if not exists processed_at timestamptz;
alter table public.registration add column if not exists processed_by uuid references auth.users(id) on delete set null;
create index if not exists idx_registration_tournament on public.registration(tournament_id, status);
create index if not exists idx_registration_email_recent on public.registration(lower(rep_email), created_at desc);

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
alter table public.device add column if not exists enabled boolean not null default true;

-- Funkcije ovlasti definiraju se nakon tablica da all.sql radi i na potpuno
-- praznom projektu.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_user where id = auth.uid() and role in ('admin','delegate'));
$$;

create or replace function public.is_owner_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_user where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_rep_of_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_user where id = auth.uid() and role = 'rep' and team_id = p_team_id);
$$;

revoke all on function public.is_owner_admin() from public;
grant execute on function public.is_owner_admin() to authenticated;

-- Gledatelj sprema samo vlastiti Expo token kroz RPC. Izravni anonimni
-- INSERT/UPDATE nad tablicom device nije dopušten.
create or replace function public.register_device(
  p_token text,
  p_language text default 'hr',
  p_followed uuid[] default '{}',
  p_prefs jsonb default null,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then return; end if;
  insert into public.device (expo_push_token, language, followed_team_ids, prefs, enabled)
  values (
    p_token,
    coalesce(p_language, 'hr'),
    coalesce(p_followed, '{}'),
    coalesce(p_prefs, '{"team_playing_soon":true,"team_goal":true,"match_end":true,"schedule_change":true,"program":false}'::jsonb),
    coalesce(p_enabled, true)
  )
  on conflict (expo_push_token) do update
    set language = excluded.language,
        followed_team_ids = excluded.followed_team_ids,
        prefs = excluded.prefs,
        enabled = excluded.enabled,
        updated_at = now();
end;
$$;

revoke all on function public.register_device(text, text, uuid[], jsonb, boolean) from public;
grant execute on function public.register_device(text, text, uuid[], jsonb, boolean) to anon, authenticated;

-- Javne prijave idu kroz provjerenu RPC funkciju, bez izravnog INSERT prava.
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
  v_id uuid;
  v_open boolean;
  v_deadline timestamptz;
  v_team text := trim(coalesce(p_team_name, ''));
  v_rep text := trim(coalesce(p_rep_name, ''));
  v_email text := lower(trim(coalesce(p_rep_email, '')));
  v_players jsonb := coalesce(p_players, '[]'::jsonb);
  v_count integer;
begin
  select registration_open, registration_deadline into v_open, v_deadline
  from public.tournament where id = p_tournament_id;
  if not found then raise exception using errcode = 'P0001', message = 'registration_unavailable'; end if;
  if not v_open or (v_deadline is not null and now() > v_deadline) then
    raise exception using errcode = 'P0001', message = 'registration_closed';
  end if;
  if length(v_team) < 2 or length(v_team) > 120
     or length(v_rep) < 2 or length(v_rep) > 120
     or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;
  if jsonb_typeof(v_players) <> 'array' or jsonb_array_length(v_players) > 40 then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_players) as roster_item(value)
    where jsonb_typeof(roster_item.value) <> 'object'
       or length(trim(coalesce(roster_item.value->>'name', ''))) < 2
       or length(trim(coalesce(roster_item.value->>'name', ''))) > 120
       or (roster_item.value ? 'number' and jsonb_typeof(roster_item.value->'number') <> 'null'
           and case
             when jsonb_typeof(roster_item.value->'number') <> 'number' then true
             when coalesce(roster_item.value->>'number', '') !~ '^[0-9]{1,3}$' then true
             else (roster_item.value->>'number')::integer > 999
           end)
  ) then raise exception using errcode = 'P0001', message = 'registration_invalid'; end if;
  if p_player_count is not null and (p_player_count < 0 or p_player_count > 40) then
    raise exception using errcode = 'P0001', message = 'registration_invalid';
  end if;
  if exists (
    select 1 from public.registration r
    where r.tournament_id = p_tournament_id and r.gender = p_gender
      and lower(trim(r.team_name)) = lower(v_team)
      and r.status in ('pending', 'approved')
  ) then raise exception using errcode = 'P0001', message = 'registration_duplicate'; end if;
  if (select count(*) from public.registration r
      where lower(r.rep_email) = v_email and r.created_at > now() - interval '1 hour') >= 3 then
    raise exception using errcode = 'P0001', message = 'registration_rate_limited';
  end if;
  v_count := jsonb_array_length(v_players);
  insert into public.registration
    (tournament_id, team_name, gender, rep_name, rep_email, player_count, players)
  values
    (p_tournament_id, v_team, p_gender, v_rep, v_email,
     case when v_count > 0 then v_count else p_player_count end, v_players)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb) from public;
grant execute on function public.submit_registration(uuid, text, public.gender, text, text, integer, jsonb) to anon, authenticated;

-- Odobravanje je atomsko i idempotentno: ekipa, igrači i status nastaju zajedno.
create or replace function public.approve_registration(p_registration_id uuid, p_short_code text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registration%rowtype;
  v_team_id uuid;
  v_code text;
  v_sort integer;
  v_player_sort integer;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'insufficient_privilege'; end if;
  select * into v_reg from public.registration where id = p_registration_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'registration_not_found'; end if;
  if v_reg.status = 'approved' and v_reg.approved_team_id is not null then return v_reg.approved_team_id; end if;
  if v_reg.status = 'rejected' then raise exception using errcode = 'P0001', message = 'registration_already_rejected'; end if;

  select id into v_team_id from public.team
  where tournament_id = v_reg.tournament_id and gender = v_reg.gender
    and lower(trim(name)) = lower(trim(v_reg.team_name))
  order by created_at limit 1;

  if v_team_id is null then
    select coalesce(max(sort_order), -1) + 1 into v_sort from public.team
    where tournament_id = v_reg.tournament_id and gender = v_reg.gender;
    v_code := left(regexp_replace(upper(coalesce(p_short_code, '')), '[^A-Z0-9]', '', 'g'), 3);
    if length(v_code) < 2 then v_code := left(regexp_replace(upper(v_reg.team_name), '[^A-Z0-9]', '', 'g'), 3); end if;
    if length(v_code) < 2 then v_code := 'EKP'; end if;
    insert into public.team (tournament_id, name, short_code, gender, rep_email, sort_order)
    values (v_reg.tournament_id, trim(v_reg.team_name), v_code, v_reg.gender, lower(trim(v_reg.rep_email)), v_sort)
    returning id into v_team_id;
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_player_sort from public.player where team_id = v_team_id;
  insert into public.player (team_id, name, number, sort_order)
  select v_team_id, trim(item.value->>'name'),
    case when item.value->>'number' is null or item.value->>'number' = '' then null else (item.value->>'number')::integer end,
    v_player_sort + item.ordinality::integer - 1
  from jsonb_array_elements(coalesce(v_reg.players, '[]'::jsonb)) with ordinality as item(value, ordinality)
  where length(trim(coalesce(item.value->>'name', ''))) > 0
    and not exists (
      select 1 from public.player p where p.team_id = v_team_id
        and lower(trim(p.name)) = lower(trim(item.value->>'name'))
        and p.number is not distinct from case
          when item.value->>'number' is null or item.value->>'number' = '' then null else (item.value->>'number')::integer end
    );

  update public.registration set status = 'approved', approved_team_id = v_team_id,
    processed_at = now(), processed_by = auth.uid() where id = p_registration_id;
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
declare v_status public.registration_status;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'insufficient_privilege'; end if;
  select status into v_status from public.registration where id = p_registration_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'registration_not_found'; end if;
  if v_status = 'approved' then raise exception using errcode = 'P0001', message = 'registration_already_approved'; end if;
  update public.registration set status = 'rejected', processed_at = now(), processed_by = auth.uid()
  where id = p_registration_id;
end;
$$;
revoke all on function public.reject_registration(uuid) from public;
grant execute on function public.reject_registration(uuid) to authenticated;

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
drop policy if exists registration_admin_read on public.registration;
create policy registration_admin_read on public.registration for select to authenticated using (public.is_admin());
drop policy if exists registration_admin_update on public.registration;
drop policy if exists registration_admin_delete on public.registration;
revoke insert, update, delete on table public.registration from anon, authenticated;

drop policy if exists device_insert on public.device;
drop policy if exists device_update on public.device;
revoke insert, update, delete on table public.device from anon, authenticated;
drop policy if exists device_admin_read on public.device;
create policy device_admin_read on public.device for select to authenticated using (public.is_admin());

drop policy if exists app_user_self_read on public.app_user;
create policy app_user_self_read on public.app_user for select to authenticated using (id = auth.uid() or public.is_owner_admin());
drop policy if exists app_user_admin_write on public.app_user;
create policy app_user_admin_write on public.app_user for all to authenticated using (public.is_owner_admin()) with check (public.is_owner_admin());

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

-- Logotipi ekipa (opcionalni; fallback je grb s kraticom).
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
