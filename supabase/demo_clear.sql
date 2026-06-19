-- demo_clear.sql — obriši SAMO demo podatke (ID počinje s '11111111-' ili '22222222-').
-- Pokreni u Supabase → SQL Editor → New query → Run.
-- Tvoji pravi podaci (drukčiji ID) ostaju netaknuti. Turnir se ne briše.

do $$
declare
  p text;
  prefixes text[] := array['11111111-1111-1111-1111-1111111111%', '22222222-2222-2222-2222-%'];
begin
  foreach p in array prefixes loop
    delete from public.match_event   where id::text like p;
    delete from public.match         where id::text like p;
    delete from public.program_item  where id::text like p;
    delete from public.player        where id::text like p;
    delete from public.registration  where id::text like p;
    delete from public.team          where id::text like p;
    delete from public.grp           where id::text like p;
    delete from public.sponsor       where id::text like p;
    delete from public.location      where id::text like p;
    delete from public.day           where id::text like p;
  end loop;
end $$;
