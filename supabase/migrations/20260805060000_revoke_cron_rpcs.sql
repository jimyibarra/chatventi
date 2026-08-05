-- =====================================================================
-- ChatVenti · Blindaje de grants de las Fases 4 y 5 (MISMO gotcha que ya
-- se documentó en 20260704040100 y se volvió a colar).
--
--   Supabase concede EXECUTE a `anon` y `authenticated` por DEFAULT
--   PRIVILEGES en CADA función nueva de `public`. Un
--   `revoke all ... from public` NO lo deshace: esos son grants DIRECTOS
--   a esos roles, no a PUBLIC. Es decir, escribir
--       revoke all on function f from public;
--       grant execute on function f to service_role;
--   deja la función igualmente abierta a cualquiera con la anon key —que
--   es pública y viaja en el navegador—.
--
--   Qué quedaba expuesto (todas cruzan datos de TODAS las orgs):
--     · get_cold_conversations  → nombres y teléfonos de clientes
--     · get_daily_report_orgs   → correos de contacto de los negocios
--     · get_daily_report_data   → cifras de cualquier organización
--     · get_conversations_to_score → conversaciones y orgs
--     · claim_* / save_conversation_score → manipulables desde fuera
--
--   Comprobación de que esto es el arreglo correcto: `get_due_reminders` y
--   `claim_reminder`, que sí llevan el revoke explícito desde 2026-07-04,
--   dan `false` para anon; estas daban `true`.
-- =====================================================================

revoke execute on function public.get_conversations_to_score(integer)      from anon, authenticated;
revoke execute on function public.claim_conversation_scoring(uuid)         from anon, authenticated;
revoke execute on function public.save_conversation_score(uuid, smallint, text) from anon, authenticated;

revoke execute on function public.get_cold_conversations(integer)          from anon, authenticated;
revoke execute on function public.claim_cold_followup(uuid)                from anon, authenticated;
revoke execute on function public.claim_daily_report(uuid, date)           from anon, authenticated;
revoke execute on function public.get_daily_report_orgs()                  from anon, authenticated;
revoke execute on function public.get_daily_report_data(uuid, date)        from anon, authenticated;

-- NO se tocan las tres que SÍ deben ser invocables por anon, porque las
-- llama el webhook (que usa la ANON key a propósito) y son estrechas por
-- diseño: attach_message_media, set_message_media_text y record_csat.
