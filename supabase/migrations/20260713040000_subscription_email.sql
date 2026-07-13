-- ---------------------------------------------------------------------
-- Correo de "suscripción activa" (2026-07-13) + backfill anti-retroactivo.
-- ---------------------------------------------------------------------

-- Idempotencia del correo de suscripción activa (una vez por org).
alter table public.subscriptions add column if not exists subscription_email_sent_at timestamptz;

-- Backfill: las orgs y suscripciones que YA existen no deben recibir correos
-- retroactivos (bienvenida/onboarding/suscripción) al activar el SMTP. Solo los
-- registros NUEVOS (creados tras el deploy) dispararán los correos.
update public.organizations
   set welcome_email_sent_at    = coalesce(welcome_email_sent_at, now()),
       onboarding_email_sent_at = coalesce(onboarding_email_sent_at, now())
 where welcome_email_sent_at is null or onboarding_email_sent_at is null;

update public.subscriptions
   set subscription_email_sent_at = coalesce(subscription_email_sent_at, now())
 where subscription_email_sent_at is null;
-- Nota: trial_ending_email_sent_at se deja NULL a propósito, para que el aviso
-- de fin de prueba sí se envíe a las pruebas vigentes cuando toque (~48h antes).
