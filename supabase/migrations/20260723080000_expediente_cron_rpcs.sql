-- RPCs del cron para los recordatorios recurrentes + wipe actualizado.
-- Mismo patron que get_due_reminders/claim_reminder: SECURITY DEFINER,
-- EXECUTE revocado a anon/authenticated (solo service_role los llama).

create or replace function public.get_due_client_reminders()
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
      'reminder_id', rm.id,
      'message', rm.message,
      'conversation_id', conv.id,
      'channel_type', ch.type,
      'channel_external_id', ch.external_id,
      'send_to', cl.phone,
      'client_name', cl.name,
      'org_name', o.name
    ) as x
    from public.client_reminders rm
    join public.clients cl on cl.id = rm.client_id
    join public.organizations o on o.id = rm.organization_id
    left join lateral (
      select c.id, c.channel_id from public.conversations c
       where c.client_id = rm.client_id
       order by c.last_message_at desc nulls last, c.created_at desc limit 1
    ) conv on true
    left join public.channels ch on ch.id = conv.channel_id
    where rm.active
      and rm.next_due_at <= now()
      and cl.phone is not null
    order by rm.next_due_at
    limit 200
  ) t;
  return v_result;
end;
$function$;

-- Reclamo atomico: avanza next_due_at en saltos de interval_days hasta dejarlo
-- en el futuro. Si el cron se atrasa varios dias NO dispara una rafaga de
-- mensajes repetidos: se manda uno y la proxima fecha queda adelante.
create or replace function public.claim_client_reminder(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_next timestamptz;
  v_days integer;
begin
  select next_due_at, interval_days into v_next, v_days
    from public.client_reminders
   where id = p_id and active and next_due_at <= now()
   for update skip locked;

  if v_next is null then
    return false;
  end if;

  while v_next <= now() loop
    v_next := v_next + make_interval(days => v_days);
  end loop;

  update public.client_reminders
     set next_due_at = v_next, last_sent_at = now()
   where id = p_id;

  return true;
end;
$function$;

revoke execute on function public.get_due_client_reminders() from anon, authenticated;
revoke execute on function public.claim_client_reminder(uuid) from anon, authenticated;

-- ---------------------------------------------------------------
-- wipe: las 3 tablas nuevas. Sin esto, al borrar los datos de una org
-- que no pago quedarian archivos clinicos y expedientes huerfanos.
-- (Los objetos del bucket `records` los borra el servidor; aqui van las filas.)
-- ---------------------------------------------------------------
create or replace function public.wipe_organization_business_data(p_org uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.appointment_services where appointment_id in
    (select id from public.appointments where organization_id = p_org);
  delete from public.appointments   where organization_id = p_org;
  delete from public.messages where conversation_id in
    (select id from public.conversations where organization_id = p_org);
  delete from public.ai_approvals   where organization_id = p_org;
  delete from public.conversations  where organization_id = p_org;
  delete from public.client_files     where organization_id = p_org;
  delete from public.client_records   where organization_id = p_org;
  delete from public.client_reminders where organization_id = p_org;
  delete from public.client_tags where client_id in
    (select id from public.clients where organization_id = p_org);
  delete from public.clients        where organization_id = p_org;
  delete from public.tags           where organization_id = p_org;
  delete from public.service_catalogs where organization_id = p_org;
  delete from public.business_hours where branch_id in
    (select id from public.branches where organization_id = p_org);
  delete from public.staff_schedules where branch_id in
    (select id from public.branches where organization_id = p_org);
  delete from public.staff_time_off where resource_id in
    (select id from public.resources where organization_id = p_org);
  delete from public.channels       where organization_id = p_org;
  delete from public.agent_configs  where organization_id = p_org;
  delete from public.knowledge_base where organization_id = p_org;
  delete from public.products       where organization_id = p_org;

  update public.organizations set data_deleted_at = now() where id = p_org;
end;
$function$;
