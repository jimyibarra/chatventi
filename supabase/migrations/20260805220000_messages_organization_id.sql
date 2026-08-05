-- `messages` no tenía `organization_id`, así que su RLS tenía que saltar a
-- `conversations` FILA A FILA:
--
--   message_select: EXISTS (select 1 from conversations c
--                            where c.id = messages.conversation_id
--                              and c.organization_id = get_my_org())
--
-- Con 150.000 mensajes concentrados en el día, el KPI "mensajes de IA hoy" del
-- panel (`src/features/dashboard/metrics.ts`) **agotaba el statement_timeout
-- (57014)**: el panel principal directamente se rompía. Medido el 2026-08-05.
--
-- Se intentó primero forzar el join desde la app (`conversations!inner`) y NO
-- bastó: 7,5 s. La causa es estructural, no de cómo se escribe la consulta.
--
-- Solución: denormalizar `organization_id` en `messages` para que la RLS sea una
-- comparación directa sobre columna indexada. Un trigger lo rellena solo, así
-- que NINGÚN escritor (las RPCs `route_inbound_message` / `log_outbound_message`,
-- el cron, los jobs con service_role) necesita cambiar.

alter table public.messages add column if not exists organization_id uuid;

-- Backfill desde la conversación.
update public.messages m
   set organization_id = c.organization_id
  from public.conversations c
 where c.id = m.conversation_id
   and m.organization_id is distinct from c.organization_id;

-- Deriva la organización en cada alta. BEFORE INSERT: cubre a todos los
-- escritores sin tocar su código.
create or replace function public.messages_set_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is null then
    select c.organization_id into new.organization_id
      from public.conversations c where c.id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_messages_set_org on public.messages;
create trigger tr_messages_set_org
  before insert on public.messages
  for each row execute function public.messages_set_org();

-- NOT NULL: una fila sin organización sería invisible para su dueño (la RLS
-- nueva la descartaría) y quedaría huérfana en silencio.
alter table public.messages alter column organization_id set not null;

alter table public.messages
  add constraint messages_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

-- El índice que sirve al KPI y a cualquier listado por organización.
create index if not exists messages_org_sender_created_idx
  on public.messages (organization_id, sender, created_at desc);
create index if not exists messages_org_idx
  on public.messages (organization_id);

-- RLS: misma semántica, sin el salto por fila.
drop policy if exists message_select on public.messages;
create policy message_select on public.messages
  for select
  using (
    get_my_role() = 'super_admin'
    or organization_id = get_my_org()
  );

drop policy if exists message_write on public.messages;
create policy message_write on public.messages
  for all
  using (
    get_my_role() = 'super_admin'
    or (organization_id = get_my_org()
        and get_my_role() = any (array['owner','manager','staff']))
  )
  with check (
    get_my_role() = 'super_admin'
    or (organization_id = get_my_org()
        and get_my_role() = any (array['owner','manager','staff']))
  );

analyze public.messages;
