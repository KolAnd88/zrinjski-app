-- seed.sql — minimalni početni podaci (jedan turnir)
-- Pokreće se kod `supabase db reset`. Sve ostalo se unosi kroz admin.

insert into public.tournament (name, season_year, match_duration_min, gap_min)
values ('VHMRK Zrinjski Cup', 2026, 15, 5)
on conflict do nothing;
