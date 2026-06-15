-- 0004_storage.sql — Storage bucket za javne medije (logotipi sponzora/ekipa).
-- Javno čitanje (gledatelji vide logotipe); pisanje samo admin/delegate.

insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

-- Javno čitanje objekata iz bucketa.
create policy "public_assets_read"
  on storage.objects for select
  using (bucket_id = 'public-assets');

-- Upload / izmjena / brisanje: samo admin/delegate (preko is_admin()).
create policy "public_assets_admin_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());
