-- 0018_tournament_texts.sql
--
-- Pravila natjecanja, format i tekst o klubu.
--
-- Dosad su ta tri teksta postojala samo u glavi organizatora: aplikacija ih
-- nije imala gdje pokazati, a admin ih nije imao gdje unijeti. Drže se na
-- `tournament` jer vrijede za cijeli turnir i uvijek postoji točno jedan skup.
--
-- Sve je idempotentno — migracija se smije pokrenuti više puta.

alter table public.tournament
  add column if not exists rules text,
  add column if not exists format text,
  add column if not exists about_club text;

comment on column public.tournament.rules is 'Pravila natjecanja, slobodan tekst u vise redaka.';
comment on column public.tournament.format is 'Format natjecanja (grupe, zavrsnica, trajanje) — slobodan tekst.';
comment on column public.tournament.about_club is 'Tekst o klubu domacinu.';

-- Citanje je vec javno kroz postojecu politiku na `tournament`, a pisanje ide
-- kroz istu admin politiku kao i ostale postavke turnira — nova polja ne
-- traze vlastita pravila.
