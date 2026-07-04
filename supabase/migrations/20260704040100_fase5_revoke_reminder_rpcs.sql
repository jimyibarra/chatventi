-- =====================================================================
-- ChatVenti · Fase 5 · Blindaje de grants (mismo gotcha de Fase 2/3):
-- Supabase concede EXECUTE a anon/authenticated por DEFAULT PRIVILEGES en
-- CADA función nueva. get_due_reminders devuelve citas/teléfonos de TODAS
-- las orgs (es solo para el cron) y claim_reminder marca envíos: NINGUNA
-- debe ser invocable por anon/authenticated. Revocar explícitamente; solo
-- service_role (el cron) conserva EXECUTE.
-- =====================================================================

revoke execute on function public.get_due_reminders(text) from anon, authenticated;
revoke execute on function public.claim_reminder(uuid, text) from anon, authenticated;
