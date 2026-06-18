-- make_admin.sql — daj sebi admin ovlasti (da web admin smije pisati u bazu).
-- Pokreni TEK NAKON što u Supabase dashboardu kreiraš svog korisnika
-- (Authentication → Users → Add user). Zamijeni e-mail svojim.

insert into public.app_user (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'TVOJ@EMAIL.com'      --  ← upiši svoj e-mail
on conflict (id) do update set role = 'admin';
