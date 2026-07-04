-- =====================================================================
-- ChatVenti · Fase 2 · Blindaje de grants (auto-annealing)
--
-- Supabase aplica ALTER DEFAULT PRIVILEGES que otorga EXECUTE a anon y
-- authenticated en CADA función nueva. Por eso, aunque en la migración de
-- RPCs solo hicimos `grant ... to authenticated`, las funciones de solo-UI
-- quedaron ejecutables por `anon`.
--
-- Riesgo: create_appointment/reschedule/set_status usan assert_org_access,
-- que SOLO bloquea a usuarios autenticados de otra org. Un llamante anon
-- tiene get_my_org() = null -> pasa el guard -> podría crear/mover/cambiar
-- citas sin sesión. El único camino anon legítimo es
-- create_appointment_from_chat (resuelve la org por el canal).
--
-- Fix: revocar EXECUTE a `anon` en las RPCs que deben ser solo-UI.
-- Se conservan anon en get_available_slots y create_appointment_from_chat
-- (los usa el motor de chat/webhook en Fase 3).
-- =====================================================================

revoke execute on function public.create_appointment(uuid, uuid[], timestamptz, uuid, uuid, text, text) from anon;
revoke execute on function public.reschedule_appointment(uuid, timestamptz, uuid) from anon;
revoke execute on function public.set_appointment_status(uuid, text) from anon;
-- assert_org_access es un helper interno; no debe ser invocable directamente.
revoke execute on function public.assert_org_access(uuid) from anon;
