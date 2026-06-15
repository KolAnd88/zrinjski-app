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
