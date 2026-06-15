-- 0005_notifications.sql — podrška za ručne obavijesti i automatske podsjetnike.

-- Ručno poslane obavijesti (admin upiše tekst) ne pripadaju automatskim tipovima.
alter type notification_type add value if not exists 'custom';

-- Postavke automatskih podsjetnika (prekidači na ekranu Obavijesti).
alter table public.tournament
  add column if not exists reminder_prefs jsonb not null default
    '{"day_before_18":true,"thirty_min_before":true,"schedule_change":true}'::jsonb;
