-- Índices de apoyo para claves foráneas que no tenían ninguno.
--
-- Motivo (hallazgo de la prueba de carga del 2026-08-05): `get_crm_overview`
-- hace un `left join lateral` sobre `appointments` por CADA cliente del negocio.
-- Sin índice en `appointments.client_id`, Postgres recorría la tabla ENTERA de
-- citas —las de todas las organizaciones— una vez por cliente.
--
-- Con 500 negocios simulados (30.000 citas) el CRM de un negocio de 40 clientes
-- tardaba 122 ms en caliente y 455 ms en frío, y el coste crecía con las citas
-- de OTROS negocios: un cliente se volvía más lento porque la plataforma crecía.
--
-- Todos son aditivos y reversibles (`drop index`). Los parciales evitan indexar
-- las filas nulas, que son la mayoría en esas columnas.

-- Críticos: caminos calientes (CRM, expediente del cliente, recordatorios)
create index if not exists appointments_client_idx
  on public.appointments (client_id) where client_id is not null;

create index if not exists conversations_client_idx
  on public.conversations (client_id) where client_id is not null;

create index if not exists client_reminders_client_idx
  on public.client_reminders (client_id);

create index if not exists csat_responses_conversation_idx
  on public.csat_responses (conversation_id);

-- Integridad referencial: sin estos, borrar un servicio o un perfil obliga
-- a un seq scan de la tabla hija para validar la FK.
create index if not exists appointment_services_service_idx
  on public.appointment_services (service_id);

create index if not exists messages_agent_idx
  on public.messages (agent_id) where agent_id is not null;

create index if not exists conversations_assigned_agent_idx
  on public.conversations (assigned_agent_id) where assigned_agent_id is not null;

create index if not exists client_files_org_idx
  on public.client_files (organization_id);

create index if not exists client_files_created_by_idx
  on public.client_files (created_by) where created_by is not null;

create index if not exists client_records_org_idx
  on public.client_records (organization_id);

create index if not exists client_records_created_by_idx
  on public.client_records (created_by) where created_by is not null;

create index if not exists client_reminders_org_idx
  on public.client_reminders (organization_id);

create index if not exists profiles_assigned_branch_idx
  on public.profiles (assigned_branch_id) where assigned_branch_id is not null;
