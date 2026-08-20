-- 0008_registration_players.sql — popis igrača uz prijavu ekipe.
--
-- Predstavnik u javnoj formi (/prijava) može odmah upisati sastav.
-- Spremamo kao jsonb polje objekata: [{ "name": "Ime Prezime", "number": 7 }]
-- (`number` smije biti null). Kod odobrenja prijave igrači se prepišu u `player`.
--
-- Zašto jsonb, a ne zasebna tablica: prijava je nacrt dok se ne odobri —
-- ne treba joinove, RLS politike ni čišćenje siročadi kod odbijanja.
-- Idempotentno — sigurno za višekratno pokretanje.

alter table public.registration
  add column if not exists players jsonb not null default '[]'::jsonb;

comment on column public.registration.players is
  'Nacrt sastava iz javne prijave: [{name, number}]. Kod odobrenja se prepisuje u player.';
