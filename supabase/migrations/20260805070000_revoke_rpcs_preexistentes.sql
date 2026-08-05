-- =====================================================================
-- ChatVenti · Blindaje de grants: fuga PREEXISTENTE encontrada al revisar
-- el mismo gotcha de las Fases 4 y 5 (Supabase concede EXECUTE a anon y
-- authenticated por DEFAULT PRIVILEGES en cada función nueva).
--
-- Estas tres NO son de esta línea de trabajo —vienen de los recordatorios
-- recurrentes del expediente y de la fusión de clientes duplicados— pero
-- tenían el mismo agujero, y ninguna valida nada por dentro:
--
--   · get_due_client_reminders() → devolvía mensajes, NOMBRES, TELÉFONOS y
--     canales de clientes de TODAS las organizaciones a cualquiera con la
--     anon key, que es pública y viaja en el navegador. Fuga de datos
--     personales, activa en producción.
--   · claim_client_reminder(uuid) → permitía consumir el recordatorio de
--     otra organización adivinando un uuid.
--   · merge_duplicate_clients() → mantenimiento GLOBAL: recorre y fusiona
--     clientes de todas las orgs. Invocable por cualquiera.
--
-- Las tres las llama únicamente el cron con service_role
-- (src/app/api/cron/appointment-reminders/route.ts), que conserva EXECUTE:
-- revocarlas de anon/authenticated no cambia nada del comportamiento.
--
-- Contraste que confirma el diagnóstico: get_due_reminders y claim_reminder
-- llevan este revoke explícito desde 2026-07-04 y daban `false` para anon;
-- estas daban `true`.
-- =====================================================================

-- 🔴 Hay DOS fuentes de permiso y hay que quitar las dos:
--   1. `PUBLIC`, que Postgres concede por defecto al crear la función
--      (se ve como `=X/postgres` en pg_proc.proacl);
--   2. `anon` / `authenticated`, que concede Supabase por DEFAULT PRIVILEGES.
-- Estas tres solo tenían la primera, así que revocar de anon/authenticated
-- NO cambió nada: `has_function_privilege('anon', …)` seguía en true y la
-- llamada con la anon key seguía devolviendo datos. Comprobado en vivo.

revoke execute on function public.get_due_client_reminders()   from public, anon, authenticated;
revoke execute on function public.claim_client_reminder(uuid)  from public, anon, authenticated;
revoke execute on function public.merge_duplicate_clients()    from public, anon, authenticated;

-- El cron conserva el suyo (ya lo tenía, se deja explícito).
grant execute on function public.get_due_client_reminders()   to service_role;
grant execute on function public.claim_client_reminder(uuid)  to service_role;
grant execute on function public.merge_duplicate_clients()    to service_role;
