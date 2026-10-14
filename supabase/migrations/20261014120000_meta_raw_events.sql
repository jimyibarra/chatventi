-- =====================================================================
-- Coexistencia con la app WhatsApp Business (fase 1: viabilidad).
--
--   Meta manda campos nuevos al webhook de WhatsApp (history,
--   smb_app_state_sync, smb_message_echoes, account_update). Mientras no
--   tengan manejador, se guardan tal cual para estudiarlos: sin Vercel CLI no
--   hay otra forma de ver lo que llega. Solo service_role lee y escribe.
--   Se limpia a los 30 días desde la corrida diaria del cron.
-- =====================================================================
create table if not exists public.meta_raw_events (
  id              uuid primary key default gen_random_uuid(),
  object          text,
  field           text not null,
  phone_number_id text,
  waba_id         text,
  payload         jsonb not null,
  created_at      timestamptz not null default now()
);
create index if not exists meta_raw_events_created_idx on public.meta_raw_events (created_at desc);
create index if not exists meta_raw_events_field_idx on public.meta_raw_events (field, created_at desc);
alter table public.meta_raw_events enable row level security;
revoke all on table public.meta_raw_events from public, anon, authenticated;
comment on table public.meta_raw_events is 'Eventos crudos de Meta sin manejador (coexistencia WhatsApp). Solo service_role.';
