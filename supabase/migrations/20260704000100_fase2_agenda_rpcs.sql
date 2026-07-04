-- =====================================================================
-- ChatVenti · Fase 2 · RPCs de agenda (SECURITY DEFINER)
--   get_available_slots        · disponibilidad respetando horario+tz
--   create_appointment         · alta desde UI (no-solapamiento, tx lock)
--   create_appointment_from_chat · alta desde webhook/IA (resuelve canal)
--   reschedule_appointment     · mover cita (revalida solapamiento)
--   set_appointment_status     · confirmar/completar/no_show/cancelar
--
-- Guardas:
--   · Zona horaria de la sucursal (branches.timezone) para construir slots.
--   · No-solapamiento serializado con pg_advisory_xact_lock por branch+staff.
--   · Aislamiento: si el llamante esta autenticado (get_my_org() no nulo),
--     debe coincidir con la org del recurso (salvo super_admin). El camino
--     anon (webhook/IA) resuelve la org por el canal, no por sesion.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guard reutilizable: valida que un usuario autenticado no opere sobre
-- otra organizacion. Anon (sin sesion) pasa: su org se resolvio por canal.
-- ---------------------------------------------------------------------
create or replace function public.assert_org_access(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_org() is not null
     and public.get_my_role() <> 'super_admin'
     and p_org <> public.get_my_org() then
    raise exception 'forbidden: organizacion ajena' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- get_available_slots
--   Devuelve huecos [slot_start, slot_end) por staff para p_date, ya en
--   timestamptz (UTC). Intersecta horario de sucursal ∩ disponibilidad de
--   staff, avanza en pasos de p_slot_interval, y descarta huecos pasados,
--   solapados con citas activas o con ausencias del staff.
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_branch_id     uuid,
  p_service_ids   uuid[],
  p_date          date,
  p_staff_id      uuid default null,
  p_slot_interval int  default 15
)
returns table (slot_start timestamptz, slot_end timestamptz, staff_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_tz       text;
  v_weekday  int;
  v_duration int;
begin
  select b.organization_id, b.timezone into v_org, v_tz
    from public.branches b where b.id = p_branch_id;
  if v_org is null then return; end if;

  perform public.assert_org_access(v_org);

  -- Duracion total de los servicios (deben ser de la misma org y estar activos).
  select coalesce(sum(sc.duration_minutes), 0) into v_duration
    from public.service_catalogs sc
   where sc.id = any(p_service_ids)
     and sc.organization_id = v_org
     and sc.active;
  if v_duration <= 0 then return; end if;

  v_weekday := extract(dow from p_date)::int;  -- 0=Domingo .. 6=Sabado

  return query
  with bh as (
    select open_time, close_time
      from public.business_hours
     where branch_id = p_branch_id and weekday = v_weekday and not is_closed
  ),
  staff as (
    select ss.staff_id, ss.start_time, ss.end_time
      from public.staff_schedules ss
     where ss.branch_id = p_branch_id and ss.weekday = v_weekday
       and (p_staff_id is null or ss.staff_id = p_staff_id)
  ),
  -- Interseccion (bloque de staff ∩ horario de sucursal) como timestamps
  -- locales del dia p_date en la zona de la sucursal.
  windows as (
    select s.staff_id,
           (p_date + greatest(s.start_time, bh.open_time))::timestamp as win_start_local,
           (p_date + least(s.end_time, bh.close_time))::timestamp     as win_end_local
      from staff s cross join bh
     where greatest(s.start_time, bh.open_time) < least(s.end_time, bh.close_time)
  ),
  candidates as (
    select w.staff_id,
           (gs at time zone v_tz)                                            as slot_start_ts,
           ((gs + make_interval(mins => v_duration)) at time zone v_tz)      as slot_end_ts
      from windows w,
        lateral generate_series(
          w.win_start_local,
          w.win_end_local - make_interval(mins => v_duration),
          make_interval(mins => p_slot_interval)
        ) as gs
  )
  select c.slot_start_ts, c.slot_end_ts, c.staff_id
    from candidates c
   where c.slot_start_ts >= now()
     and not exists (
       select 1 from public.appointments a
        where a.branch_id = p_branch_id
          and a.staff_id  = c.staff_id
          and a.status not in ('cancelled','no_show')
          and a.starts_at < c.slot_end_ts
          and a.ends_at   > c.slot_start_ts
     )
     and not exists (
       select 1 from public.staff_time_off t
        where t.staff_id  = c.staff_id
          and t.starts_at < c.slot_end_ts
          and t.ends_at   > c.slot_start_ts
     )
   order by c.slot_start_ts, c.staff_id;
end;
$$;

-- ---------------------------------------------------------------------
-- create_appointment (UI)
--   No-solapamiento: si hay staff -> por staff; si no -> la sucursal se
--   trata como recurso unico. Serializado con advisory lock transaccional.
-- ---------------------------------------------------------------------
create or replace function public.create_appointment(
  p_branch_id   uuid,
  p_service_ids uuid[],
  p_starts_at   timestamptz,
  p_client_id   uuid default null,
  p_staff_id    uuid default null,
  p_source      text default 'staff',
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_duration int;
  v_ends     timestamptz;
  v_appt     uuid;
begin
  select organization_id into v_org from public.branches where id = p_branch_id;
  if v_org is null then raise exception 'branch_not_found'; end if;

  perform public.assert_org_access(v_org);

  select coalesce(sum(duration_minutes), 0) into v_duration
    from public.service_catalogs
   where id = any(p_service_ids) and organization_id = v_org and active;
  if v_duration <= 0 then raise exception 'invalid_services'; end if;

  v_ends := p_starts_at + make_interval(mins => v_duration);

  -- Serializa reservas concurrentes del mismo recurso (branch + staff).
  perform pg_advisory_xact_lock(hashtext(p_branch_id::text || coalesce(p_staff_id::text, 'any')));

  if exists (
    select 1 from public.appointments a
     where a.branch_id = p_branch_id
       and a.status not in ('cancelled','no_show')
       and a.starts_at < v_ends and a.ends_at > p_starts_at
       and (p_staff_id is null or a.staff_id = p_staff_id)
  ) then
    raise exception 'slot_taken: el horario ya esta ocupado' using errcode = '23P01';
  end if;

  insert into public.appointments
      (organization_id, branch_id, client_id, staff_id, starts_at, ends_at, source, notes)
    values
      (v_org, p_branch_id, p_client_id, p_staff_id, p_starts_at, v_ends, coalesce(p_source, 'staff'), p_notes)
    returning id into v_appt;

  insert into public.appointment_services (appointment_id, service_id)
    select v_appt, unnest(p_service_ids);

  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------
-- create_appointment_from_chat (webhook / IA)
--   Resuelve org por canal (type + external_id), upsert del cliente por
--   telefono, elige sucursal (param o unica de la org) y delega en
--   create_appointment con source segun el canal.
-- ---------------------------------------------------------------------
create or replace function public.create_appointment_from_chat(
  p_channel_type text,
  p_external_id  text,
  p_client_phone text,
  p_service_ids  uuid[],
  p_starts_at    timestamptz,
  p_branch_id    uuid default null,
  p_staff_id     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_branch uuid;
  v_client uuid;
begin
  select organization_id into v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_org is null then raise exception 'channel_not_found'; end if;

  -- Sucursal: la indicada o la unica de la org.
  if p_branch_id is not null then
    select id into v_branch from public.branches
     where id = p_branch_id and organization_id = v_org;
  else
    select id into v_branch from public.branches
     where organization_id = v_org order by created_at limit 1;
  end if;
  if v_branch is null then raise exception 'branch_not_found'; end if;

  -- Upsert del cliente por telefono dentro de la org (patron route_inbound_message).
  if coalesce(trim(p_client_phone), '') <> '' then
    insert into public.clients (organization_id, phone)
      values (v_org, trim(p_client_phone))
    on conflict (organization_id, phone) do update set phone = excluded.phone
    returning id into v_client;
  end if;

  return public.create_appointment(
    v_branch, p_service_ids, p_starts_at, v_client, p_staff_id,
    case p_channel_type when 'whatsapp' then 'whatsapp'
                        when 'telegram' then 'telegram'
                        else 'ai' end,
    null
  );
end;
$$;

-- ---------------------------------------------------------------------
-- reschedule_appointment
--   Mueve la cita (y opcionalmente cambia staff), recalculando la
--   duracion desde sus servicios y revalidando no-solapamiento (excluye
--   la propia cita).
-- ---------------------------------------------------------------------
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at  timestamptz,
  p_new_staff_id   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_branch   uuid;
  v_staff    uuid;
  v_duration int;
  v_ends     timestamptz;
begin
  select organization_id, branch_id, staff_id
    into v_org, v_branch, v_staff
    from public.appointments where id = p_appointment_id;
  if v_org is null then raise exception 'appointment_not_found'; end if;

  perform public.assert_org_access(v_org);

  if p_new_staff_id is not null then v_staff := p_new_staff_id; end if;

  select coalesce(sum(sc.duration_minutes), 0) into v_duration
    from public.appointment_services aps
    join public.service_catalogs sc on sc.id = aps.service_id
   where aps.appointment_id = p_appointment_id;
  if v_duration <= 0 then v_duration := 30; end if;  -- fallback defensivo

  v_ends := p_new_starts_at + make_interval(mins => v_duration);

  perform pg_advisory_xact_lock(hashtext(v_branch::text || coalesce(v_staff::text, 'any')));

  if exists (
    select 1 from public.appointments a
     where a.branch_id = v_branch
       and a.id <> p_appointment_id
       and a.status not in ('cancelled','no_show')
       and a.starts_at < v_ends and a.ends_at > p_new_starts_at
       and (v_staff is null or a.staff_id = v_staff)
  ) then
    raise exception 'slot_taken: el horario ya esta ocupado' using errcode = '23P01';
  end if;

  update public.appointments
     set starts_at = p_new_starts_at,
         ends_at   = v_ends,
         staff_id  = v_staff
   where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- set_appointment_status
-- ---------------------------------------------------------------------
create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_status not in ('scheduled','confirmed','completed','cancelled','no_show') then
    raise exception 'invalid_status';
  end if;

  select organization_id into v_org from public.appointments where id = p_appointment_id;
  if v_org is null then raise exception 'appointment_not_found'; end if;

  perform public.assert_org_access(v_org);

  update public.appointments set status = p_status where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- GRANTS (patron _harden_function_grants: revocar public, otorgar por rol)
-- ---------------------------------------------------------------------
revoke all on function public.assert_org_access(uuid) from public;
grant execute on function public.assert_org_access(uuid) to anon, authenticated;

revoke all on function public.get_available_slots(uuid, uuid[], date, uuid, int) from public;
grant execute on function public.get_available_slots(uuid, uuid[], date, uuid, int) to anon, authenticated;

revoke all on function public.create_appointment(uuid, uuid[], timestamptz, uuid, uuid, text, text) from public;
grant execute on function public.create_appointment(uuid, uuid[], timestamptz, uuid, uuid, text, text) to authenticated;

revoke all on function public.create_appointment_from_chat(text, text, text, uuid[], timestamptz, uuid, uuid) from public;
grant execute on function public.create_appointment_from_chat(text, text, text, uuid[], timestamptz, uuid, uuid) to anon, authenticated;

revoke all on function public.reschedule_appointment(uuid, timestamptz, uuid) from public;
grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid) to authenticated;

revoke all on function public.set_appointment_status(uuid, text) from public;
grant execute on function public.set_appointment_status(uuid, text) to authenticated;
