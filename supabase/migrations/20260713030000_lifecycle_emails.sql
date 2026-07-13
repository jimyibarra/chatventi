-- ---------------------------------------------------------------------
-- Correos de ciclo de vida (2026-07-13): marcas de idempotencia para no
-- reenviar bienvenida / onboarding / recordatorio de fin de prueba.
-- ---------------------------------------------------------------------

alter table public.organizations add column if not exists welcome_email_sent_at     timestamptz;
alter table public.organizations add column if not exists onboarding_email_sent_at  timestamptz;
alter table public.subscriptions add column if not exists trial_ending_email_sent_at timestamptz;
