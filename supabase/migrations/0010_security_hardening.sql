-- 0010_security_hardening.sql — zatvaranje anonimnog pisanja uređaja i
-- razdvajanje ovlasti admina od delegata.
--
-- Sigurno za višekratno pokretanje. Ne mijenja podatke.

-- `is_admin()` namjerno ostaje "operativno osoblje" (admin + delegate) jer se
-- koristi za turnir, raspored i unos uživo. Za upravljanje računima treba uža
-- provjera koja prihvaća samo pravog admina.
create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_owner_admin() from public;
grant execute on function public.is_owner_admin() to authenticated;

-- Stare politike iz 0002 dopuštale su anonimnom korisniku UPDATE bilo kojeg
-- retka ako bi saznao token. Od 0009 jedini javni put pisanja je security
-- definer RPC `register_device`, koji dira samo red svog tokena.
drop policy if exists device_insert on public.device;
drop policy if exists device_update on public.device;
revoke insert, update, delete on table public.device from anon, authenticated;

-- Korisnik uvijek smije pročitati vlastiti profil. Cijeli popis i promjene
-- računa smije raditi samo admin; delegat ostaje operativna uloga.
drop policy if exists app_user_self_read on public.app_user;
create policy app_user_self_read
  on public.app_user for select
  to authenticated
  using (id = auth.uid() or public.is_owner_admin());

drop policy if exists app_user_admin_write on public.app_user;
create policy app_user_admin_write
  on public.app_user for all
  to authenticated
  using (public.is_owner_admin())
  with check (public.is_owner_admin());

