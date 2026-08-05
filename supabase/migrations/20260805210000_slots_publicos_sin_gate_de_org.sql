-- Arregla: un usuario de ChatVenti con sesión iniciada NO podía ver los huecos
-- en la página pública de reservas de OTRO negocio que también use ChatVenti
-- (403). Caso real: la dueña de una peluquería que es clienta de la veterinaria
-- de al lado, y ambas usan ChatVenti.
--
-- Causa: `get_available_slots_v2` llamaba a `assert_org_access(v_org)`, que deja
-- pasar al anónimo (`get_my_org()` es null) pero rechaza a un logueado de otra
-- organización.
--
-- Por qué se puede quitar sin abrir nada: esta función ya es ejecutable por
-- `anon` a propósito —es el motor de la página pública de reservas—, así que la
-- disponibilidad ya es información pública. El `assert` no protegía nada: solo
-- dejaba al usuario CON sesión más restringido que a un desconocido, que es
-- justo al revés.
--
-- El candado se mantiene intacto en las otras 7 funciones que lo usan
-- (create_appointment_v2, reschedule_appointment_v2, pause_ai, resume_ai,
-- set_ai_enabled, set_appointment_status, set_conversation_status): esas SÍ
-- escriben o exponen datos internos y no son públicas.

create or replace function public.get_available_slots_v2(
  p_branch_id uuid,
  p_service_ids uuid[],
  p_date date,
  p_resource_id uuid default null,
  p_slot_interval integer default 15
)
returns table (slot_start timestamptz, slot_end timestamptz, resource_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_org uuid; v_tz text; v_weekday int; v_duration int;
begin
  select b.organization_id, b.timezone into v_org, v_tz
    from public.branches b where b.id = p_branch_id;
  if v_org is null then return; end if;

  -- (Aquí vivía `perform public.assert_org_access(v_org);` — ver cabecera.)

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
         not exists (select 1 from public.resource_services rs where rs.resource_id = ss.resource_id)
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
$$;

-- `create or replace` conserva los grants existentes, pero los repongo explícitos
-- para no depender de ello (las DOS fuentes, aprendizaje 2026-08-05).
revoke execute on function public.get_available_slots_v2(uuid, uuid[], date, uuid, integer) from public;
grant  execute on function public.get_available_slots_v2(uuid, uuid[], date, uuid, integer)
  to anon, authenticated, service_role;
