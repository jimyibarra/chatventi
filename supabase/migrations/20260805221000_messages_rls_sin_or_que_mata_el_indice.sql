-- Continuación de `20260805220000_messages_organization_id`.
--
-- Denormalizar `organization_id` e indexarlo NO bastó: el KPI del panel seguía
-- agotando el statement_timeout. La causa real estaba en la FORMA de la policy:
--
--   using ( get_my_role() = 'super_admin' OR organization_id = get_my_org() )
--
-- Ese `OR` contra algo que no es una columna **inutiliza cualquier índice**: si
-- la primera rama pudiera ser cierta, valdrían todas las filas, así que el
-- planificador no puede convertir la policy en condición de índice y evalúa
-- fila a fila. Con la misma consulta escrita con filtro explícito de
-- organización, el plan era `Index Only Scan` en 0,8 ms.
--
-- Medido el 2026-08-05 con 150.000 mensajes, KPI "mensajes de IA hoy":
--   antes  → 500, statement_timeout (>8.000 ms)
--   ahora  → 189 ms extremo a extremo (de los que ~150 son latencia de red)
--
-- Se quita la rama de super_admin: el panel de administración NO lee `messages`
-- directamente, solo usa RPCs `admin_*` (SECURITY DEFINER), que siguen igual. Si
-- algún día necesita leer mensajes, va por RPC como el resto del panel.
--
-- Los `(select ...)` fuerzan un InitPlan: la función se evalúa UNA vez por
-- consulta en lugar de una vez por fila.

drop policy if exists message_select on public.messages;
create policy message_select on public.messages
  for select
  using ( organization_id = (select public.get_my_org()) );

drop policy if exists message_write on public.messages;
create policy message_write on public.messages
  for all
  using (
    organization_id = (select public.get_my_org())
    and (select public.get_my_role()) = any (array['owner','manager','staff'])
  )
  with check (
    organization_id = (select public.get_my_org())
    and (select public.get_my_role()) = any (array['owner','manager','staff'])
  );
