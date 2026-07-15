-- =====================================================================
-- ChatVenti · Ola 4 · Fase 2 · RPCs de agenda conscientes del RECURSO
--   get_available_slots_v2 · create_appointment_v2 ·
--   create_appointment_from_chat_v2 · create_public_appointment_v2 ·
--   reschedule_appointment_v2
--
-- ESTRATEGIA: expand/contract (ver Fase 1). Estas funciones son NUEVAS.
--   Las viejas (p_staff_id) quedan INTACTAS: son las que sirve produccion
--   hasta el deploy de las Fases 2-5. La Fase 7 las dropea.
--
--   El sufijo _v2 es DEFINITIVO. Postgres identifica una funcion por
--   nombre + TIPOS de argumentos: get_available_slots(p_staff_id uuid,...)
--   y get_available_slots(p_resource_id uuid,...) son la MISMA firma con
--   distinto nombre de parametro -> "cannot change name of input parameter".
--   Renombrarlas en la Fase 7 exigiria una ventana coordinada con el
--   deploy, o sea reintroducir en pequeño el riesgo que expand/contract
--   elimina. No se hace.
--
-- Cuerpos portados de la definicion VIVA en la BD (volcada con
-- pg_get_functiondef), NO de las migraciones: get_available_slots estaba
-- definida dos veces y la viva es la del fix de fase 4.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. TRIGGER DE TRANSICION v2: ademas de vincular, CREA el recurso
--
--    Caso detectado al mapear la Fase 2: una org que se registre durante
--    la ventana (antes del deploy) y configure horario con la UI vieja
--    tendria un profile SIN recurso -> el horario quedaria con
--    resource_id NULL -> invisible para las RPCs _v2 al desplegar, y su
--    vinculo se perderia al dropear staff_id en la Fase 7.
--    Con esto, cualquier fila que llegue por el camino viejo queda
--    integrada sola. Se dropea entero en la Fase 7.
-- ---------------------------------------------------------------------
create or replace function public.tr_sync_resource_from_staff()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_res uuid;
begin
  if new.resource_id is null and new.staff_id is not null then
    select r.id into v_res from public.resources r where r.profile_id = new.staff_id;

    -- Sin recurso aun: crearlo desde el profile (mismo criterio que el
    -- backfill de la Fase 1). Solo para profiles de tenant, nunca super_admin.
    if v_res is null then
      insert into public.resources (organization_id, branch_id, profile_id, name, active)
      select p.organization_id, p.assigned_branch_id, p.id,
             coalesce(nullif(btrim(p.full_name), ''), split_part(coalesce(p.email,''), '@', 1), 'Profesional'),
             p.is_active
        from public.profiles p
       where p.id = new.staff_id
         and p.organization_id is not null
         and p.role <> 'super_admin'
      on conflict do nothing
      returning id into v_res;

      -- Si otra transaccion lo creo primero, el DO NOTHING no devuelve fila:
      -- releer para no perder el vinculo.
      if v_res is null then
        select r.id into v_res from public.resources r where r.profile_id = new.staff_id;
      end if;
    end if;

    new.resource_id := v_res;
  end if;
  return new;
end $$;

revoke execute on function public.tr_sync_resource_from_staff() from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 1. HUECOS DISPONIBLES POR RECURSO
--
--    Diferencias vs la vieja:
--    a) Opera sobre staff_schedules.resource_id (no staff_id).
--    b) Filtra por resource_services: solo recursos que prestan TODOS los
--       servicios pedidos. REGLA: un recurso SIN servicios configurados
--       presta TODO. Sin esta regla, los 4 recursos backfilleados en la
--       Fase 1 (que no tienen filas en resource_services) devolverian
--       CERO huecos y romperian las 4 orgs al desplegar.
--    c) Valida que p_resource_id sea de la org (assert_org_access deja
--       pasar a anon a proposito: la org se resuelve por canal/slug).
--
--    Semantica de NULL CONSERVADA: una cita con resource_id NULL sigue
--    bloqueando la sucursal entera (`a.resource_id is null`), igual que
--    hoy. Cubre las citas heredadas y las orgs sin recursos.
--    Nota: una org sin recursos tampoco tiene staff_schedules, y sin
--    horarios esta funcion ya no devolvia huecos -> no hay que bifurcar.
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots_v2(
  p_branch_id     uuid,
  p_service_ids   uuid[],
  p_date          date,
  p_resource_id   uuid default null,
  p_slot_interval integer default 15
)
returns table(slot_start timestamptz, slot_end timestamptz, resource_id uuid)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_tz text; v_weekday int; v_duration int;
begin
  select b.organization_id, b.timezone into v_org, v_tz
    from public.branches b where b.id = p_branch_id;
  if v_org is null then return; end if;
  perform public.assert_org_access(v_org);

  -- recurso ajeno -> sin huecos (no filtrar aqui = fuga entre orgs por anon)
  if p_resource_id is not null and not exists (
    select 1 from public.resources r
     where r.id = p_resource_id and r.organization_id = v_org and r.active
  ) then
    return;
  end if;

  select coalesce(sum(sc.duration_minutes), 0) into v_duration
    from public.service_catalogs sc
   where sc.id = any(p_service_ids) and sc.organization_id = v_org and sc.active;
  if v_duration <= 0 then return; end if;
  v_weekday := extract(dow from p_date)::int;

  return query
  with bh as (
    select open_time, close_time from public.business_hours
     where branch_id = p_branch_id and weekday = v_weekday and not is_closed
  ),
  res as (
    select ss.resource_id as rid, ss.start_time, ss.end_time
      from public.staff_schedules ss
      join public.resources r on r.id = ss.resource_id and r.active
     where ss.branch_id = p_branch_id
       and ss.weekday = v_weekday
       and ss.resource_id is not null
       and (p_resource_id is null or ss.resource_id = p_resource_id)
       and (
         -- sin servicios configurados = presta todo
         not exists (select 1 from public.resource_services rs where rs.resource_id = ss.resource_id)
         -- o cubre TODOS los pedidos
         or not exists (
           select 1 from unnest(p_service_ids) as sid
            where not exists (
              select 1 from public.resource_services rs
               where rs.resource_id = ss.resource_id and rs.service_id = sid
            )
         )
       )
  ),
  windows as (
    select s.rid,
           (p_date + greatest(s.start_time, bh.open_time))::timestamp as win_start_local,
           (p_date + least(s.end_time, bh.close_time))::timestamp     as win_end_local
      from res s cross join bh
     where greatest(s.start_time, bh.open_time) < least(s.end_time, bh.close_time)
  ),
  candidates as (
    select w.rid,
           (gs at time zone v_tz) as slot_start_ts,
           ((gs + make_interval(mins => v_duration)) at time zone v_tz) as slot_end_ts
      from windows w,
        lateral generate_series(
          w.win_start_local, w.win_end_local - make_interval(mins => v_duration),
          make_interval(mins => p_slot_interval)
        ) as gs
  )
  select c.slot_start_ts, c.slot_end_ts, c.rid
    from candidates c
   where c.slot_start_ts >= now()
     and not exists (
       select 1 from public.appointments a
        where a.branch_id = p_branch_id
          and (a.resource_id = c.rid or a.resource_id is null)
          and a.status not in ('cancelled','no_show')
          and a.starts_at < c.slot_end_ts and a.ends_at > c.slot_start_ts
     )
     and not exists (
       select 1 from public.staff_time_off t
        where t.resource_id = c.rid
          and t.starts_at < c.slot_end_ts and t.ends_at > c.slot_start_ts
     )
   order by c.slot_start_ts, c.rid;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2. CREAR CITA POR RECURSO ("el que sea" resuelto DENTRO del lock)
--
--    Advisory lock a nivel SUCURSAL (no por recurso): con "el que sea",
--    dos reservas concurrentes elegirian el mismo profesional libre si
--    cada una lockease su propio recurso. Se reutiliza a proposito la
--    clave de la funcion vieja (branch || 'any') para que, durante el
--    rollout del deploy (Vercel sirve viejo y nuevo unos segundos), las
--    reservas por ambos caminos sigan serializando entre si.
-- ---------------------------------------------------------------------
create or replace function public.create_appointment_v2(
  p_branch_id   uuid,
  p_service_ids uuid[],
  p_starts_at   timestamptz,
  p_client_id   uuid default null,
  p_resource_id uuid default null,
  p_source      text default 'staff',
  p_notes       text default null
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org uuid; v_tz text; v_duration int; v_ends timestamptz; v_appt uuid;
  v_resource uuid; v_has_resources boolean; v_weekday int;
begin
  select b.organization_id, b.timezone into v_org, v_tz
    from public.branches b where b.id = p_branch_id;
  if v_org is null then raise exception 'branch_not_found'; end if;
  perform public.assert_org_access(v_org);

  select coalesce(sum(duration_minutes), 0) into v_duration
    from public.service_catalogs
   where id = any(p_service_ids) and organization_id = v_org and active;
  if v_duration <= 0 then raise exception 'invalid_services'; end if;
  v_ends := p_starts_at + make_interval(mins => v_duration);

  -- recurso ajeno: el chat y la web publica llegan como anon y
  -- assert_org_access los deja pasar (la org se resuelve por canal/slug),
  -- asi que el recurso hay que validarlo explicitamente contra v_org.
  if p_resource_id is not null then
    if not exists (
      select 1 from public.resources r
       where r.id = p_resource_id and r.organization_id = v_org and r.active
    ) then
      raise exception 'resource_not_found';
    end if;
    v_resource := p_resource_id;
  end if;

  select exists (
    select 1 from public.resources r where r.organization_id = v_org and r.active
  ) into v_has_resources;

  perform pg_advisory_xact_lock(hashtext(p_branch_id::text || 'any'));

  -- "el que sea": elegir el primer profesional libre DENTRO del lock.
  if v_resource is null and v_has_resources then
    v_weekday := extract(dow from (p_starts_at at time zone v_tz))::int;

    select r.id into v_resource
      from public.resources r
     where r.organization_id = v_org
       and r.active
       and (r.branch_id is null or r.branch_id = p_branch_id)
       and (
         not exists (select 1 from public.resource_services rs where rs.resource_id = r.id)
         or not exists (
           select 1 from unnest(p_service_ids) as sid
            where not exists (
              select 1 from public.resource_services rs
               where rs.resource_id = r.id and rs.service_id = sid
            )
         )
       )
       and not exists (
         select 1 from public.appointments a
          where a.resource_id = r.id
            and a.status not in ('cancelled','no_show')
            and a.starts_at < v_ends and a.ends_at > p_starts_at
       )
       and not exists (
         select 1 from public.staff_time_off t
          where t.resource_id = r.id
            and t.starts_at < v_ends and t.ends_at > p_starts_at
       )
     order by
       -- preferir a quien tenga horario ese dia en esta sucursal; si nadie
       -- lo tiene (alta manual fuera de horario desde el panel), cae en
       -- cualquiera libre en vez de fallar.
       (exists (
          select 1 from public.staff_schedules ss
           where ss.resource_id = r.id
             and ss.branch_id = p_branch_id
             and ss.weekday = v_weekday
       )) desc,
       r.sort_order, r.name
     limit 1;

    if v_resource is null then
      raise exception 'no_resource_available: ningun profesional libre' using errcode = '23P01';
    end if;
  end if;

  -- Solapamiento. v_resource NULL (org sin recursos) = exclusividad de
  -- sucursal, la semantica de hoy. Con recurso, bloquean sus citas y las
  -- heredadas sin recurso.
  if exists (
    select 1 from public.appointments a
     where a.branch_id = p_branch_id
       and a.status not in ('cancelled','no_show')
       and a.starts_at < v_ends and a.ends_at > p_starts_at
       and (v_resource is null or a.resource_id = v_resource or a.resource_id is null)
  ) then
    raise exception 'slot_taken: el horario ya esta ocupado' using errcode = '23P01';
  end if;

  insert into public.appointments
      (organization_id, branch_id, client_id, resource_id, starts_at, ends_at, source, notes)
    values (v_org, p_branch_id, p_client_id, v_resource, p_starts_at, v_ends,
            coalesce(p_source, 'staff'), p_notes)
    returning id into v_appt;
  insert into public.appointment_services (appointment_id, service_id)
    select v_appt, unnest(p_service_ids);
  return v_appt;
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. CITA DESDE EL CHAT (webhook = anon)
-- ---------------------------------------------------------------------
create or replace function public.create_appointment_from_chat_v2(
  p_channel_type text,
  p_external_id  text,
  p_client_phone text,
  p_service_ids  uuid[],
  p_starts_at    timestamptz,
  p_branch_id    uuid default null,
  p_resource_id  uuid default null
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_client uuid;
begin
  select organization_id into v_org from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled' limit 1;
  if v_org is null then raise exception 'channel_not_found'; end if;

  if p_branch_id is not null then
    select id into v_branch from public.branches where id = p_branch_id and organization_id = v_org;
  else
    select id into v_branch from public.branches where organization_id = v_org order by created_at limit 1;
  end if;
  if v_branch is null then raise exception 'branch_not_found'; end if;

  -- El recurso llega del agente (anon). Validarlo contra la org resuelta
  -- por canal, o se podria reservar contra recursos de otra org.
  if p_resource_id is not null and not exists (
    select 1 from public.resources r
     where r.id = p_resource_id and r.organization_id = v_org and r.active
  ) then
    raise exception 'resource_not_found';
  end if;

  if coalesce(trim(p_client_phone), '') <> '' then
    insert into public.clients (organization_id, phone) values (v_org, trim(p_client_phone))
    on conflict (organization_id, phone) do update set phone = excluded.phone
    returning id into v_client;
  end if;

  return public.create_appointment_v2(
    v_branch, p_service_ids, p_starts_at, v_client, p_resource_id,
    case p_channel_type when 'whatsapp' then 'whatsapp' when 'telegram' then 'telegram' else 'ai' end,
    null
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 4. CITA DESDE LA WEB PUBLICA /r/[slug] (anon)
-- ---------------------------------------------------------------------
create or replace function public.create_public_appointment_v2(
  p_slug         text,
  p_service_ids  uuid[],
  p_starts_at    timestamptz,
  p_client_name  text,
  p_client_phone text,
  p_resource_id  uuid default null
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_client uuid;
begin
  select o.id, b.id into v_org, v_branch
    from public.organizations o
    join public.branches b on b.organization_id = o.id
   where o.web_slug = p_slug order by b.created_at limit 1;
  if v_org is null then raise exception 'not_published'; end if;
  if v_branch is null then raise exception 'branch_not_found'; end if;
  if coalesce(trim(p_client_phone), '') = '' then raise exception 'phone_required'; end if;

  -- mismo motivo que en _from_chat_v2: el slug resuelve la org, el recurso no.
  if p_resource_id is not null and not exists (
    select 1 from public.resources r
     where r.id = p_resource_id and r.organization_id = v_org and r.active
  ) then
    raise exception 'resource_not_found';
  end if;

  insert into public.clients (organization_id, phone, name)
    values (v_org, trim(p_client_phone), nullif(trim(p_client_name), ''))
  on conflict (organization_id, phone)
    do update set name = coalesce(nullif(trim(p_client_name), ''), public.clients.name)
  returning id into v_client;

  return public.create_appointment_v2(
    v_branch, p_service_ids, p_starts_at, v_client, p_resource_id, 'web', null
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 5. REPROGRAMAR POR RECURSO
-- ---------------------------------------------------------------------
create or replace function public.reschedule_appointment_v2(
  p_appointment_id  uuid,
  p_new_starts_at   timestamptz,
  p_new_resource_id uuid default null
)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_resource uuid; v_duration int; v_ends timestamptz;
begin
  select organization_id, branch_id, resource_id into v_org, v_branch, v_resource
    from public.appointments where id = p_appointment_id;
  if v_org is null then raise exception 'appointment_not_found'; end if;
  perform public.assert_org_access(v_org);

  if p_new_resource_id is not null then
    if not exists (
      select 1 from public.resources r
       where r.id = p_new_resource_id and r.organization_id = v_org and r.active
    ) then
      raise exception 'resource_not_found';
    end if;
    v_resource := p_new_resource_id;
  end if;

  select coalesce(sum(sc.duration_minutes), 0) into v_duration
    from public.appointment_services aps
    join public.service_catalogs sc on sc.id = aps.service_id
   where aps.appointment_id = p_appointment_id;
  if v_duration <= 0 then v_duration := 30; end if;
  v_ends := p_new_starts_at + make_interval(mins => v_duration);

  perform pg_advisory_xact_lock(hashtext(v_branch::text || 'any'));

  if exists (
    select 1 from public.appointments a
     where a.branch_id = v_branch
       and a.id <> p_appointment_id
       and a.status not in ('cancelled','no_show')
       and a.starts_at < v_ends and a.ends_at > p_new_starts_at
       and (v_resource is null or a.resource_id = v_resource or a.resource_id is null)
  ) then
    raise exception 'slot_taken: el horario ya esta ocupado' using errcode = '23P01';
  end if;

  update public.appointments
     set starts_at = p_new_starts_at, ends_at = v_ends, resource_id = v_resource
   where id = p_appointment_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- 6. GRANTS — replican EXACTAMENTE los de las funciones viejas
--    (verificado con aclexplode sobre pg_proc antes de escribir esto):
--      get_available_slots            -> anon, authenticated
--      create_appointment             -> authenticated   (sin anon)
--      create_appointment_from_chat   -> anon, authenticated
--      create_public_appointment      -> anon, authenticated
--      reschedule_appointment         -> authenticated   (sin anon)
--    `create or replace` no arrastra los grants de la funcion vieja: son
--    funciones NUEVAS y nacen con EXECUTE para PUBLIC. Hay que revocar y
--    conceder a mano (patron de fase0_harden_function_grants).
-- ---------------------------------------------------------------------
revoke execute on function public.get_available_slots_v2(uuid, uuid[], date, uuid, integer) from public;
grant  execute on function public.get_available_slots_v2(uuid, uuid[], date, uuid, integer) to anon, authenticated;

revoke execute on function public.create_appointment_v2(uuid, uuid[], timestamptz, uuid, uuid, text, text) from anon, public;
grant  execute on function public.create_appointment_v2(uuid, uuid[], timestamptz, uuid, uuid, text, text) to authenticated;

revoke execute on function public.create_appointment_from_chat_v2(text, text, text, uuid[], timestamptz, uuid, uuid) from public;
grant  execute on function public.create_appointment_from_chat_v2(text, text, text, uuid[], timestamptz, uuid, uuid) to anon, authenticated;

revoke execute on function public.create_public_appointment_v2(text, uuid[], timestamptz, text, text, uuid) from public;
grant  execute on function public.create_public_appointment_v2(text, uuid[], timestamptz, text, text, uuid) to anon, authenticated;

revoke execute on function public.reschedule_appointment_v2(uuid, timestamptz, uuid) from anon, public;
grant  execute on function public.reschedule_appointment_v2(uuid, timestamptz, uuid) to authenticated;
