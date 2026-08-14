-- =====================================================================
-- ChatVenti · HARDENING de seguridad (auditoría 2026-08-14)
--
-- CIERRA la fuga CRÍTICA: la familia de RPCs "internas del agente/webhook"
-- estaba EXECUTE-granted a `anon` (la anon key es PÚBLICA, viaja en el
-- navegador). Como son SECURITY DEFINER y NO autentican al llamante, cualquiera
-- con la anon key podía llamarlas por PostgREST saltándose la firma HMAC del
-- webhook:
--   · get_agent_context  -> leer la conversación privada de OTRO negocio
--     (historial, nombre del cliente, citas, system_prompt, chat de aprobación)
--     con solo (channel_type, external_id público, teléfono del cliente).
--   · route_inbound_message -> inyectar mensajes ENTRANTES falsos en cualquier
--     canal (el page id de Messenger es público).
--   · log_outbound_message  -> forjar mensajes SALIENTES con la voz del negocio.
--   · resolve_ai_approval   -> aprobar/rechazar borradores y leer su texto.
--
-- ARQUITECTURA CORRECTA: estas RPCs solo se llaman DESDE EL SERVIDOR (webhooks
-- tras validar HMAC, cron, sandbox), que YA dispone del cliente service_role.
-- Por eso se revoca de anon/authenticated y se deja solo a service_role.
--
-- 🔴 ESTA MIGRACIÓN VA ACOPLADA AL CAMBIO DE CÓDIGO que hace que el webhook y
--    runAgent llamen con createServiceClient() en vez de createWebhookClient().
--    Aplicar la migración SIN el código deja el webhook sin permisos.
--
-- NO se tocan las RPCs públicas legítimas (reserva web / enlace mágico), que
-- son token/slug-scoped y deben seguir siendo anon:
--   get_public_booking_context, get_available_slots_v2, create_public_appointment_v2,
--   get_appointment_by_token, {cancel,confirm,reschedule}_appointment_by_token,
--   consume_rate_limit, count_rate_events, get_invitation_preview.
-- =====================================================================

-- Familia interna del agente/webhook: solo service_role.
revoke execute on function public.get_agent_context(text, text, text)                      from anon, authenticated;
revoke execute on function public.route_inbound_message(text, text, text, text, text, text) from anon, authenticated;
revoke execute on function public.log_outbound_message(uuid, text, text, text)              from anon, authenticated;
revoke execute on function public.resolve_ai_approval(uuid, boolean)                        from anon, authenticated;
revoke execute on function public.create_ai_approval(uuid, text, jsonb)                     from anon, authenticated;
revoke execute on function public.set_client_name_from_chat(text, text, text, text)         from anon, authenticated;
revoke execute on function public.get_manage_token_from_chat(text, text, text, uuid)        from anon, authenticated;
revoke execute on function public.create_appointment_from_chat_v2(text, text, text, uuid[], timestamptz, uuid, uuid) from anon, authenticated;
revoke execute on function public.cancel_appointment_from_chat(text, text, text, uuid)      from anon, authenticated;
revoke execute on function public.reschedule_appointment_from_chat(text, text, text, uuid, timestamptz) from anon, authenticated;
revoke execute on function public.confirm_appointment_from_chat(text, text, text, uuid)     from anon, authenticated;
revoke execute on function public.record_csat(text, text, text, uuid, smallint)             from anon, authenticated;
revoke execute on function public.set_message_media_text(uuid, text)                        from anon, authenticated;
revoke execute on function public.attach_message_media(uuid, text, text)                    from anon, authenticated;

-- upsert_client_manual: el CRM la llama AUTENTICADO (sesión del dueño). Solo
-- se cierra el vector anon; se conserva authenticated.
revoke execute on function public.upsert_client_manual(text, text) from anon;

-- messages_set_org es una función de TRIGGER (no se invoca por API). El grant a
-- anon/authenticated sobra: se retira.
revoke execute on function public.messages_set_org() from anon, authenticated;

-- Garantiza que service_role sigue pudiendo ejecutarlas (idempotente).
grant execute on function public.get_agent_context(text, text, text)                      to service_role;
grant execute on function public.route_inbound_message(text, text, text, text, text, text) to service_role;
grant execute on function public.log_outbound_message(uuid, text, text, text)              to service_role;
grant execute on function public.resolve_ai_approval(uuid, boolean)                        to service_role;
grant execute on function public.create_ai_approval(uuid, text, jsonb)                     to service_role;
grant execute on function public.set_client_name_from_chat(text, text, text, text)         to service_role;
grant execute on function public.get_manage_token_from_chat(text, text, text, uuid)        to service_role;
grant execute on function public.create_appointment_from_chat_v2(text, text, text, uuid[], timestamptz, uuid, uuid) to service_role;
grant execute on function public.cancel_appointment_from_chat(text, text, text, uuid)      to service_role;
grant execute on function public.reschedule_appointment_from_chat(text, text, text, uuid, timestamptz) to service_role;
grant execute on function public.confirm_appointment_from_chat(text, text, text, uuid)     to service_role;
grant execute on function public.record_csat(text, text, text, uuid, smallint)             to service_role;
grant execute on function public.set_message_media_text(uuid, text)                        to service_role;
grant execute on function public.attach_message_media(uuid, text, text)                    to service_role;
grant execute on function public.upsert_client_manual(text, text)                          to service_role;
