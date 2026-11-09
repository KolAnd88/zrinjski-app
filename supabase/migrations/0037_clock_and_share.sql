-- 0037_clock_and_share.sql — sat utakmice s pauzom i time-outom + lagane
-- slike za dijeljenje rezultata.
--
-- SAT UTAKMICE
-- Dosad je baza pamtila samo minutu (current_minute), a sat je brojao na
-- ekranu zapisničara od klika na „Počni” — nije se mogao zaustaviti. Sada se
-- pamti stanje sata, iz kojeg svaki uređaj sam izračuna vrijeme:
--
--   vrijeme = clock_base_sec + (clock_running ? sada − clock_started_at : 0)
--
--   • clock_running    — teče li sat;
--   • clock_base_sec   — sekunde odigrane prije zadnjeg pokretanja;
--   • clock_started_at — kad je sat zadnji put pokrenut (null dok stoji);
--   • timeout_team_id / timeout_started_at — tekući time-out (traje 1 min);
--   • home_timeouts / away_timeouts — koliko je time-outa ekipa iskoristila.
--
-- current_minute se i dalje upisuje: verzija aplikacije 1.2.0 i starije
-- čitaju samo nju.
--
-- SLIKE ZA DIJELJENJE
-- Slika rezultata je u sebi nosila logotipe svih sponzora u punoj veličini
-- (~2,9 MB) i rušila aplikaciju na Androidu. Sada admin jednom složi:
--   • tournament.share_sponsors_url — jedna mala slika sa svim sponzorima;
--   • team.logo_small_url           — umanjen grb ekipe.
-- Pri dijeljenju se na mobitelu slažu samo grbovi, rezultat i strijelci.
--
-- Idempotentno: smije se pokrenuti više puta.

alter table public.match
  add column if not exists clock_running      boolean     not null default false,
  add column if not exists clock_base_sec     int         not null default 0,
  add column if not exists clock_started_at   timestamptz,
  add column if not exists timeout_team_id    uuid references public.team(id) on delete set null,
  add column if not exists timeout_started_at timestamptz,
  add column if not exists home_timeouts      int         not null default 0,
  add column if not exists away_timeouts      int         not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'match_clock_base_nonneg') then
    alter table public.match
      add constraint match_clock_base_nonneg check (clock_base_sec >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'match_timeouts_nonneg') then
    alter table public.match
      add constraint match_timeouts_nonneg check (home_timeouts >= 0 and away_timeouts >= 0);
  end if;
end $$;

comment on column public.match.clock_base_sec is
  'Sekunde odigrane prije zadnjeg pokretanja sata. Vrijeme = base + (running ? now - started_at : 0).';
comment on column public.match.timeout_team_id is
  'Ekipa koja je zatražila tekući time-out (1 min); null kad time-outa nema.';

alter table public.team
  add column if not exists logo_small_url text;
comment on column public.team.logo_small_url is
  'Umanjen grb (do 192 px) za sliku rezultata; izrađuje ga web admin.';

alter table public.tournament
  add column if not exists share_sponsors_url text;
comment on column public.tournament.share_sponsors_url is
  'Jedna slika sa svim sponzorima (zlatni → partneri) za sliku rezultata; izrađuje je web admin.';
