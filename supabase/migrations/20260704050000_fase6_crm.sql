-- =====================================================================
-- ChatVenti · Fase 6 · CRM: etiquetas de clientes + notas
--   Reutiliza clients (Fase 1). Añade tags / client_tags + clients.notes.
--   RLS por organización (directo o vía relación, patrón de fases previas).
-- =====================================================================

alter table public.clients add column if not exists notes text;

-- ---------------------------------------------------------------------
-- ETIQUETAS (por organización)
-- ---------------------------------------------------------------------
create table if not exists public.tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  color           text not null default '#64748b',
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists tags_org_idx on public.tags(organization_id);

create table if not exists public.client_tags (
  client_id uuid not null references public.clients(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  primary key (client_id, tag_id)
);
create index if not exists client_tags_tag_idx on public.client_tags(tag_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.tags        enable row level security;
alter table public.client_tags enable row level security;

-- tags: organization_id directo
drop policy if exists tag_select on public.tags;
create policy tag_select on public.tags for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists tag_write on public.tags;
create policy tag_write on public.tags for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

-- client_tags: vía el cliente -> org
drop policy if exists ctag_select on public.client_tags;
create policy ctag_select on public.client_tags for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.clients c
               where c.id = client_tags.client_id and c.organization_id = public.get_my_org())
  );
drop policy if exists ctag_write on public.client_tags;
create policy ctag_write on public.client_tags for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.clients c
               where c.id = client_tags.client_id and c.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager','staff'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.clients c
               where c.id = client_tags.client_id and c.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager','staff'))
  );
