-- 0006_team_sort_order.sql — redoslijed ekipa (određuje i boju grba).
--
-- Boja grba se od sada računa iz indeksa: crestColorFor(team.sort_order).
-- Ponavljanje boja je dopušteno i nije greška — boja NIJE nositelj informacije.
-- `team.color` se zadržava u bazi (više se ne koristi u UI-ju); briše se kasnije
-- kad se potvrdi da auto-boje rade.
-- Idempotentno — sigurno za višekratno pokretanje.

alter table public.team add column if not exists sort_order int not null default 0;

-- Popuni redoslijed postojećim ekipama: unutar turnira + spola, abecedno.
with numbered as (
  select id, (row_number() over (partition by tournament_id, gender order by name) - 1) as idx
  from public.team
)
update public.team t
set sort_order = n.idx
from numbered n
where t.id = n.id and t.sort_order = 0;

create index if not exists idx_team_sort on public.team(tournament_id, gender, sort_order);
