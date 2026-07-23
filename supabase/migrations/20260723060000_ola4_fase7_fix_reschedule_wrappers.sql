-- Fase 7 · correccion: dos wrappers llamaban a la RPC v1 reschedule_appointment,
-- dropeada en 20260723050000. Se repuntan a _v2.
--
-- 🔴 APRENDIZAJE: el chequeo previo al CONTRACT busco 'staff_id' en el cuerpo de
-- las funciones y dio 0. Estas dos NO lo nombran: pasan el 3er argumento como
-- `null` posicional. Antes de dropear una RPC hay que buscar quien la llama POR
-- SU NOMBRE (pg_proc.prosrc), no por el parametro que se retira. Lo cazo el E2E
-- del enlace magico en produccion, no el typecheck ni el SQL.
--
-- Afectaba a: /c/<token> (cliente reagenda) y al agente IA reagendando por
-- WhatsApp/Telegram.

create or replace function public.reschedule_appointment_by_token(p_token uuid, p_new_starts_at timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id     uuid;
  v_status text;
  v_starts timestamptz;
begin
  v_id := public._resolve_token_appointment(p_token);
  select status, starts_at into v_status, v_starts
    from public.appointments where id = v_id;
  if v_status not in ('scheduled', 'confirmed') or v_starts <= now()
     or p_new_starts_at <= now() then
    raise exception 'not_actionable';
  end if;
  perform public.reschedule_appointment_v2(v_id, p_new_starts_at, null);
end;
$function$;

create or replace function public.reschedule_appointment_from_chat(p_channel_type text, p_external_id text, p_client_phone text, p_appointment_id uuid, p_new_starts_at timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public._resolve_chat_appointment(
    p_channel_type, p_external_id, p_client_phone, p_appointment_id);

  if p_new_starts_at <= now() then
    raise exception 'not_actionable';
  end if;

  perform public.reschedule_appointment_v2(p_appointment_id, p_new_starts_at, null);
end;
$function$;
