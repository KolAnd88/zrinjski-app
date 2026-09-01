-- 0028 — potvrde isporuke (Expo receipts).
--
-- Expo na slanje odgovori "ok" čim PRIMI poruku. To NIJE dokaz da je stigla:
-- pravi ishod dolazi tek u potvrdi (receipt) minutu-dvije kasnije, i ondje se
-- vide greške koje se drukčije ne mogu vidjeti — istekao FCM ključ, odjavljen
-- uređaj, poruka odbijena. Dosad se to nigdje nije provjeravalo, pa je slanje
-- moglo tiho padati a sučelje javljati uspjeh.
--
-- Karte se spremaju pri slanju, a obrađuju pri SLJEDEĆEM slanju — tada su
-- sigurno dovoljno stare. Tako nema potrebe za zasebnim rasporedom poslova.

create table if not exists public.push_ticket (
  id          text primary key,              -- Expo ticket id
  token       text not null,                 -- kome je slano (za čišćenje mrtvih)
  created_at  timestamptz not null default now(),
  checked_at  timestamptz,                   -- kad je potvrda dohvaćena
  status      text,                          -- 'ok' | 'error'
  error       text                           -- npr. DeviceNotRegistered
);

create index if not exists idx_push_ticket_pending
  on public.push_ticket (created_at)
  where checked_at is null;

alter table public.push_ticket enable row level security;

-- Piše i čita isključivo edge funkcija preko service_role, koji zaobilazi RLS.
-- Adminu se dopušta čitanje da se u sučelju vidi stvarna isporuka.
drop policy if exists push_ticket_admin_read on public.push_ticket;
create policy push_ticket_admin_read on public.push_ticket
  for select using (public.is_admin());

revoke insert, update, delete on table public.push_ticket from anon, authenticated;

comment on table public.push_ticket is
  'Expo potvrde isporuke. Upisuje ih send-push pri slanju, a obrađuje pri sljedećem pozivu.';
