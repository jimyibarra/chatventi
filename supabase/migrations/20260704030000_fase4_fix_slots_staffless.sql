-- =====================================================================
-- ChatVenti · Fase 4 · Fix: get_available_slots debe reflejar las citas
-- SIN staff (nivel-sucursal, como reservan chat/web).
--
-- Bug: get_available_slots solo excluía solapes con citas del MISMO staff
-- (a.staff_id = c.staff_id). Pero create_appointment con staff NULL valida
-- a nivel de sucursal (cualquier solape). Resultado: una cita sin staff no
-- quitaba el hueco de la disponibilidad mostrada, aunque la reserva luego
-- fallara con slot_taken. Fix: una cita con staff_id NULL bloquea el hueco
-- para TODOS (la sucursal se trata como recurso único en ese horario).
-- =====================================================================

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

  select coalesce(sum(sc.duration_minutes), 0) into v_duration
    from public.service_catalogs sc
   where sc.id = any(p_service_ids)
     and sc.organization_id = v_org
     and sc.active;
  if v_duration <= 0 then return; end if;

  v_weekday := extract(dow from p_date)::int;

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
  windows as (
    select s.staff_id,
           (p_date + greatest(s.start_time, bh.open_time))::timestamp as win_start_local,
           (p_date + least(s.end_time, bh.close_time))::timestamp     as win_end_local
      from staff s cross join bh
     where greatest(s.start_time, bh.open_time) < least(s.end_time, bh.close_time)
  ),
  candidates as (
    select w.staff_id,
           (gs at time zone v_tz)                                       as slot_start_ts,
           ((gs + make_interval(mins => v_duration)) at time zone v_tz) as slot_end_ts
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
          -- una cita del mismo staff, O una cita sin staff (bloquea toda la sucursal)
          and (a.staff_id = c.staff_id or a.staff_id is null)
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
