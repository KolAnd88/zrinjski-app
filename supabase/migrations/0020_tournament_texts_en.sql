-- 0020_tournament_texts_en.sql — engleska inačica tekstova turnira.
--
-- Migracija 0018 dala je jedno polje po tekstu, pa je korisnik s engleskim
-- sučeljem svejedno dobivao hrvatski tekst. Aplikacija je dvojezična po
-- pravilu projekta (CLAUDE.md), a ovo su jedini tekstovi koji su to prekršili.
--
-- Zašto zasebni stupci, a ne jsonb {hr,en}: jezika je točno dva i unaprijed
-- poznata, pa stupci ostaju tipizirani kroz generirane TS tipove i ne traže
-- provjeru oblika pri svakom čitanju.
--
-- Prazno englesko polje NIJE greška: organizator ga smije ostaviti prazno, a
-- aplikacija tada pokazuje hrvatski tekst. Bolje razumljiv hrvatski nego
-- prazan ekran.
--
-- Idempotentno — smije se pokrenuti više puta.

alter table public.tournament
  add column if not exists rules_en text,
  add column if not exists format_en text,
  add column if not exists about_club_en text;

comment on column public.tournament.rules_en is 'Pravila na engleskom; prazno → prikazuje se hrvatski.';
comment on column public.tournament.format_en is 'Format na engleskom; prazno → prikazuje se hrvatski.';
comment on column public.tournament.about_club_en is 'O klubu na engleskom; prazno → prikazuje se hrvatski.';
