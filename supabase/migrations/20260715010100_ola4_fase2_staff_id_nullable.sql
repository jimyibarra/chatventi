-- =====================================================================
-- ChatVenti · Ola 4 · Fase 2 · staff_id pasa a NULLABLE en la agenda
--
-- Detectado al escribir la prueba funcional de la Fase 2:
-- staff_schedules.staff_id y staff_time_off.staff_id eran NOT NULL desde
-- `20260704000000_fase2_agenda_schema.sql`, así que un profesional SIN
-- cuenta de login NO podía tener horario — que es exactamente lo que este
-- PRP viene a resolver. (appointments.staff_id ya era nullable.)
--
-- Compatible con expand/contract: es una RELAJACIÓN. El código desplegado
-- siempre envía staff_id, así que quitar la restricción no le afecta.
-- La Fase 7 (CONTRACT) dropea la columna entera.
-- =====================================================================
alter table public.staff_schedules alter column staff_id drop not null;
alter table public.staff_time_off  alter column staff_id drop not null;

-- Coherencia: cada fila debe tener AL MENOS uno de los dos. Durante la
-- transición llegan filas con staff_id (código viejo; el trigger
-- tr_sync_resource_from_staff rellena resource_id) o con resource_id
-- (código nuevo, sin staff_id).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_schedules_owner_check') then
    alter table public.staff_schedules
      add constraint staff_schedules_owner_check
      check (staff_id is not null or resource_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_time_off_owner_check') then
    alter table public.staff_time_off
      add constraint staff_time_off_owner_check
      check (staff_id is not null or resource_id is not null);
  end if;
end $$;
