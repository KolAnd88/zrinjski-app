-- 0003_realtime.sql — Realtime publikacija
-- Uživo rezultat i tijek moraju se vidjeti odmah na korisničkim uređajima.
-- match + match_event obavezno; sponsor + program_item korisno (rjeđe mijene).

alter publication supabase_realtime add table public.match;
alter publication supabase_realtime add table public.match_event;
alter publication supabase_realtime add table public.sponsor;
alter publication supabase_realtime add table public.program_item;

-- Za REPLICA IDENTITY FULL (da DELETE/UPDATE eventi nose stare vrijednosti u realtime):
alter table public.match        replica identity full;
alter table public.match_event  replica identity full;
