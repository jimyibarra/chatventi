-- Ola 4 · Fase 7: CONTRACT — retirar el camino viejo (staff_id)
--
-- Precondicion cumplida: Fases 1-6 desplegadas el 2026-07-15 (commit 4158e99),
-- 8 dias de produccion sana. El ultimo llamador de una RPC v1 en el codigo
-- (el enlace magico /c/<token>) se migro a _v2 y se desplego en cbf646c ANTES
-- de esta migracion.
--
-- Estado verificado antes de aplicar:
--   staff_schedules: 16 filas, 0 sin resource_id
--   staff_time_off:   0 filas
--   appointments:     3 filas, 0 con staff_id no nulo y resource_id nulo
--   resources:        5

-- ---------------------------------------------------------------
-- 1. RLS de staff_time_off: colgaba de staff_id -> profiles.
--    Se reescribe sobre resource_id -> resources (misma semantica de org/rol).
--    OJO: sin esto, dropear la columna dejaria la tabla con RLS y sin policy.
-- ---------------------------------------------------------------
drop policy if exists timeoff_select on public.staff_time_off;
drop policy if exists timeoff_write  on public.staff_time_off;

create policy timeoff_select on public.staff_time_off for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (
      select 1 from public.resources r
      where r.id = staff_time_off.resource_id
        and r.organization_id = public.get_my_org()
    )
  );

create policy timeoff_write on public.staff_time_off for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (
      select 1 from public.resources r
      where r.id = staff_time_off.resource_id
        and r.organization_id = public.get_my_org()
        and public.get_my_role() in ('owner','manager')
    )
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (
      select 1 from public.resources r
      where r.id = staff_time_off.resource_id
        and r.organization_id = public.get_my_org()
        and public.get_my_role() in ('owner','manager')
    )
  );

-- ---------------------------------------------------------------
-- 2. wipe_organization_business_data borraba staff_time_off por staff_id.
--    Se repunta a resource_id (unico cambio; el resto del cuerpo es identico).
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

-- ---------------------------------------------------------------
-- 3. Trigger puente de la ventana de transicion (integraba las filas que
--    llegaban por el camino viejo). Ya no hay camino viejo.
-- ---------------------------------------------------------------
drop trigger if exists sync_resource_from_staff on public.staff_schedules;
drop trigger if exists sync_resource_from_staff on public.staff_time_off;
drop trigger if exists sync_resource_from_staff on public.appointments;
drop function if exists public.tr_sync_resource_from_staff();

-- ---------------------------------------------------------------
-- 4. RPCs v1. Las _v2 conservan su nombre a proposito (ver PRP): renombrarlas
--    exigiria una ventana coordinada = reintroducir el riesgo que evitamos.
-- ---------------------------------------------------------------
drop function if exists public.get_available_slots(uuid, uuid[], date, uuid, integer);
drop function if exists public.create_appointment(uuid, uuid[], timestamptz, uuid, uuid, text, text);
drop function if exists public.create_appointment_from_chat(text, text, text, uuid[], timestamptz, uuid, uuid);
drop function if exists public.reschedule_appointment(uuid, timestamptz, uuid);
drop function if exists public.create_public_appointment(text, uuid[], timestamptz, text, text);

-- ---------------------------------------------------------------
-- 5. La columna. resource_id queda como unica autoridad.
--    (drop column elimina tambien sus indices y FKs)
-- ---------------------------------------------------------------
alter table public.staff_schedules drop column staff_id;
alter table public.staff_time_off  drop column staff_id;
alter table public.appointments    drop column staff_id;

-- ---------------------------------------------------------------
-- 6. Un horario SIEMPRE pertenece a un recurso (una cita puede no tenerlo:
--    "el que sea" deja appointments.resource_id nulo a proposito).
-- ---------------------------------------------------------------
alter table public.staff_schedules alter column resource_id set not null;
alter table public.staff_time_off  alter column resource_id set not null;
