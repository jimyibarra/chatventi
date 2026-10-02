-- =====================================================================
-- Recordatorios cada 15 minutos, sin costo: pg_cron + pg_net de Supabase
-- llaman al mismo endpoint del cron con ?scope=reminders.
--
--   Vercel (plan gratuito) solo permite UNA corrida al día. Con una sola
--   corrida, el recordatorio de "2 horas antes" solo le llegaba a las citas
--   que cayeran justo después de las 8:00. Esta corrida frecuente manda solo
--   lo que tiene hora (24 h, 2 h y el mensaje post-cita en horario decente);
--   lo demás sigue en la corrida diaria.
--
--   🔴 EL SECRETO NO VA EN ESTE ARCHIVO. Se carga aparte, una sola vez:
--     select vault.create_secret('<CRON_SECRET>', 'cron_secret', '…');
--   Sin él, la llamada sale sin credencial y el endpoint responde 401.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. get_due_reminders: mismas ventanas, dos reglas nuevas.
--    Al correr cada 15 min, una cita agendada para dentro de un rato recibía
--    su "recordatorio" a los pocos minutos de haberla pedido: un mensaje que
--    estorba y que desde oct-2026 cuesta. Ahora:
--      · 24 h → solo si se agendó con más de un día de anticipación, y nunca
--               a menos de 3 h de la cita (ahí ya manda el de 2 h).
--      · 2 h  → solo si se agendó con más de 3 h de anticipación.
--      · post-cita → solo citas terminadas en los últimos 3 días. Sin tope,
--               una cita sin canal quedaba "pendiente" para siempre y su
--               agradecimiento podía salir meses después.
--    Y se añade `ends_at`, que la corrida frecuente usa para el post-cita.
--    `create or replace` conserva los permisos (solo service_role).
-- ---------------------------------------------------------------------
create or replace function public.get_due_reminders(p_kind text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'appointment_id', a.id,
      'manage_token', a.manage_token,
      'conversation_id', conv.id,
      'channel_type', ch.type,
      'channel_external_id', ch.external_id,
      'send_to', cl.phone,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'tz', b.timezone,
      'org_name', o.name,
      'client_name', cl.name,
      'service_names', (
        select string_agg(sc.name, ', ')
          from public.appointment_services aps
          join public.service_catalogs sc on sc.id = aps.service_id
         where aps.appointment_id = a.id
      )
    ) as x
    from public.appointments a
    join public.organizations o on o.id = a.organization_id
    join public.branches b on b.id = a.branch_id
    join public.clients cl on cl.id = a.client_id
    left join lateral (
      select c.id, c.channel_id from public.conversations c
       where c.client_id = a.client_id
       order by c.last_message_at desc nulls last, c.created_at desc limit 1
    ) conv on true
    left join public.channels ch on ch.id = conv.channel_id
    where cl.phone is not null and (
      (p_kind = '24h' and a.status in ('scheduled','confirmed')
        and a.reminder_24h_sent_at is null
        and a.starts_at > now() + interval '3 hours'
        and a.starts_at <= now() + interval '24 hours'
        and a.created_at < a.starts_at - interval '24 hours')
      or (p_kind = '2h' and a.status in ('scheduled','confirmed')
        and a.reminder_2h_sent_at is null
        and a.starts_at > now() and a.starts_at <= now() + interval '2 hours'
        and a.created_at < a.starts_at - interval '3 hours')
      or (p_kind = 'followup' and a.status in ('scheduled','confirmed','completed')
        and a.followup_sent_at is null and a.ends_at < now()
        and a.ends_at > now() - interval '3 days')
    )
    order by a.starts_at limit 200
  ) t;
  return v_result;
end;
$function$;

revoke execute on function public.get_due_reminders(text) from public, anon, authenticated;
grant execute on function public.get_due_reminders(text) to service_role;

-- ---------------------------------------------------------------------
-- 2. Programador: extensiones y trabajos.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Recordatorios: cada 15 minutos. El secreto se lee de Vault en cada corrida.
select cron.schedule(
  'chatventi-recordatorios-15min',
  '*/15 * * * *',
  $job$
  select net.http_get(
    url := 'https://www.chatventi.com/api/cron/appointment-reminders?scope=reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $job$
);

-- El historial de corridas crece 96 filas al día: se conserva una semana.
select cron.schedule(
  'chatventi-limpia-historial-cron',
  '17 3 * * *',
  $job$delete from cron.job_run_details where end_time < now() - interval '7 days'$job$
);
