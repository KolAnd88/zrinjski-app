-- 0016_realtime_team_day.sql — ekipe i dani u realtime objavu.
--
-- Aplikacija se pretplaćuje na promjene tablica `team` i `day` da bi se
-- odobrena prijava ekipe odmah vidjela gledateljima (brojka "EKIPA" na
-- Početnoj, popisi ekipa, poredak). Bez uvrštenja u publikaciju pretplata
-- TIHO ne radi — klijent se uredno spoji, ali događaj nikad ne stigne.
--
-- Sigurno za višekratno pokretanje.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'team'
  ) then
    alter publication supabase_realtime add table public.team;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'day'
  ) then
    alter publication supabase_realtime add table public.day;
  end if;
end $$;

-- DELETE i UPDATE moraju nositi stare vrijednosti, inače klijent ne zna
-- što je nestalo (npr. obrisana ekipa).
alter table public.team replica identity full;
alter table public.day  replica identity full;
