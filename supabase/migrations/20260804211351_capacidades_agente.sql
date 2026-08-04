-- =====================================================================
-- Catálogo de capacidades del agente (PRP prp-superpoderes-agente · Fase 1)
--
-- Hasta ahora el único interruptor era `agent_configs.enabled`, global.
-- Estas columnas permiten activar cada superpoder por separado.
--
-- 🔴 TODAS nacen en false: con todo apagado, el sistema se comporta
-- exactamente igual que antes de este PRP. Es el criterio de éxito nº2.
--
-- Aplicada con supabase.apply_migration (queda registrada en
-- supabase_migrations.schema_migrations con esta misma versión).
-- =====================================================================
alter table public.agent_configs
  add column if not exists cap_vision        boolean not null default false,
  add column if not exists cap_transcribe    boolean not null default false,
  add column if not exists cap_scoring       boolean not null default false,
  add column if not exists cap_csat          boolean not null default false,
  add column if not exists cap_cold_followup boolean not null default false,
  add column if not exists cap_daily_report  boolean not null default false;

comment on column public.agent_configs.cap_vision is
  'Lee imágenes entrantes (comprobantes). Consume IA. Requiere la ingesta de media (Fase 2).';
comment on column public.agent_configs.cap_transcribe is
  'Transcribe notas de voz. Consume IA y un proveedor de STT distinto de OpenRouter.';
comment on column public.agent_configs.cap_scoring is
  'Califica cada conversación 1-5 con motivo y avisa al dueño si es mala. Consume IA.';
comment on column public.agent_configs.cap_csat is
  'Pide calificación al cliente tras la cita, integrada en el follow-up que ya pregunta.';
comment on column public.agent_configs.cap_cold_followup is
  'Un único mensaje de reactivación a conversaciones sin cita e inactivas.';
comment on column public.agent_configs.cap_daily_report is
  'Correo diario al dueño con la actividad del día anterior.';
