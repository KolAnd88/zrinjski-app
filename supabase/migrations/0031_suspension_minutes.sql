-- 0031_suspension_minutes.sql — trajanje isključenja kao postavka.
--
-- Na veteranskom turniru isključenje traje 1 minutu, a ne 2 kao u pravilima.
-- Do sada je dvojka bila upisana u tekst na tri mjesta (natpis gumba u unosu
-- uživo, tijek utakmice, zapisnik za ispis), pa se nije mogla promijeniti bez
-- izmjene koda.
--
-- Zadano ostaje 2 — to je pravilo igre; turnir koji igra drukčije to sam kaže.
--
-- NAPOMENA o imenu: vrijednost enuma `event_type` i dalje glasi
-- 'suspension_2min'. Ime je povijesno i sada je nepotpuno, ali preimenovanje
-- bi diralo svaki zapis događaja i svako mjesto u kodu, a ne bi promijenilo
-- ponašanje ni za piksel. Ime je ključ, minuta je podatak.

alter table public.tournament
  add column if not exists suspension_min integer not null default 2;

comment on column public.tournament.suspension_min is
  'Koliko minuta traje isključenje. Pravila kažu 2; veteranski turniri često igraju 1.';

-- Vrijednost mora imati smisla kao trajanje: nula bi značila da isključenja
-- nema, a dvoznamenkasti broj je sigurno pogreška u unosu.
alter table public.tournament
  drop constraint if exists tournament_suspension_min_check;
alter table public.tournament
  add constraint tournament_suspension_min_check
  check (suspension_min between 1 and 10);
