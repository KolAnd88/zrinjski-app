-- 0007_team_logos.sql — logotipi ekipa (Storage).
--
-- NAPOMENA: stupac `team.logo_url` VEĆ postoji (migracija 0001) pa se ne dodaje.
-- Ovdje se postavlja samo bucket i politike.
--
-- Logo je OPCIONALAN: ako ga nema, grb je krug u boji crestColorFor(sort_order)
-- s 2–3 slovnom kraticom. Datoteka se sprema kao `{team_id}.png`.
-- Idempotentno — sigurno za višekratno pokretanje.

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

-- Javno čitanje (gledatelji vide logotipe bez prijave).
drop policy if exists team_logos_read on storage.objects;
create policy team_logos_read
  on storage.objects for select
  using (bucket_id = 'team-logos');

-- Pisanje/izmjena/brisanje: samo admin (public.is_admin() pokriva admin + delegate).
drop policy if exists team_logos_admin_write on storage.objects;
create policy team_logos_admin_write
  on storage.objects for all
  to authenticated
  using (bucket_id = 'team-logos' and public.is_admin())
  with check (bucket_id = 'team-logos' and public.is_admin());
