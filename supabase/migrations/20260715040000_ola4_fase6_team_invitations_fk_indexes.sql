-- =====================================================================
-- ChatVenti · Ola 4 · Fase 6 · Índices de FK que faltaban en team_invitations
--
-- Detectado por `get_advisors(performance)` (unindexed_foreign_keys, INFO).
-- Sin ellos, borrar un profile o un resource obliga a un seq scan sobre
-- team_invitations para resolver el ON DELETE SET NULL.
-- Es la costumbre del proyecto: toda FK lleva índice
-- (staff_schedules_branch_idx, resources_org_idx, appointments_branch_idx...).
-- =====================================================================
create index if not exists team_invitations_invited_by_idx on public.team_invitations(invited_by);
create index if not exists team_invitations_resource_idx   on public.team_invitations(resource_id);
