-- 0015_contacts.sql — kontakti organizatora, vidljivi gledateljima u Info tabu.
--
-- Do sada je jedini kontakt u aplikaciji bio rep_email na ekipi, koji vidi samo
-- admin. Gledatelj koji na terenu treba nazvati nekoga iz organizacije nije
-- imao gdje pogledati broj.
--
-- Namjerno javno čitanje: ovo su brojevi koje organizacija SAMA objavljuje kao
-- službene, isto kao na plakatu. Tko ne želi biti javan, ne upisuje se.
--
-- Sigurno za višekratno pokretanje.

create table if not exists public.contact (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournament(id) on delete cascade,
  name          text not null,
  role          text,                       -- "Direktor turnira", "Delegat"…
  phone         text,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_contact_tournament on public.contact (tournament_id);

alter table public.contact enable row level security;

-- Isti obrazac kao ostatak javnog sadržaja iz 0002: svi čitaju, piše osoblje.
drop policy if exists contact_read on public.contact;
create policy contact_read
  on public.contact for select
  using (true);

drop policy if exists contact_admin_write on public.contact;
create policy contact_admin_write
  on public.contact for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.contact is
  'Kontakti organizatora koji se javno prikazuju u Info tabu aplikacije.';

-- Realtime: ispravljen broj stiže na uređaje bez ponovnog pokretanja app-a.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'contact'
  ) then
    alter publication supabase_realtime add table public.contact;
  end if;
end $$;
