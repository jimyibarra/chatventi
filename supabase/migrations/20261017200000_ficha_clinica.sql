-- =====================================================================
-- 17-oct-2026 · Fase 5: ficha clínica (dentista, consultorio médico,
-- nutrición, psicología, dermatología)
--
--   · clinical_profiles: una por paciente (formulario de primera vez: motivo,
--     alergias, antecedentes, medicamentos) + el CONSENTIMIENTO expreso para
--     tratar sus datos de salud (cuándo, cómo y quién lo registró). Sin
--     consentimiento no hay ficha (NOT NULL).
--   · clinical_notes: nota por consulta, de solo agregar (no se borran ni se
--     editan: el expediente clínico se conserva). «Próximo control» deja un
--     recordatorio (source 'clinical').
--
-- Seguridad: datos sensibles. Solo DUEÑO y GERENTE leen y escriben (el
-- personal de recepción no). La recepcionista IA nunca los recibe (no están
-- en get_agent_context).
-- =====================================================================

create table if not exists public.clinical_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  reason text check (reason is null or length(reason) <= 1000),
  allergies text check (allergies is null or length(allergies) <= 1000),
  conditions text check (conditions is null or length(conditions) <= 2000),
  medications text check (medications is null or length(medications) <= 1000),
  notes text check (notes is null or length(notes) <= 2000),
  consent_at timestamptz not null,
  consent_method text not null check (consent_method in ('firma_papel', 'firma_digital', 'otro')),
  consent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_profiles_org_idx on public.clinical_profiles (organization_id);
create index if not exists clinical_profiles_consent_by_idx on public.clinical_profiles (consent_by) where consent_by is not null;

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  occurred_on date not null default current_date,
  note text not null check (length(trim(note)) between 1 and 4000),
  next_control_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists clinical_notes_client_idx on public.clinical_notes (client_id, occurred_on desc);
create index if not exists clinical_notes_org_idx on public.clinical_notes (organization_id);
create index if not exists clinical_notes_appointment_idx on public.clinical_notes (appointment_id) where appointment_id is not null;
create index if not exists clinical_notes_created_by_idx on public.clinical_notes (created_by) where created_by is not null;

alter table public.clinical_profiles enable row level security;
alter table public.clinical_notes enable row level security;

drop policy if exists clinical_profiles_select on public.clinical_profiles;
drop policy if exists clinical_profiles_insert on public.clinical_profiles;
drop policy if exists clinical_profiles_update on public.clinical_profiles;
create policy clinical_profiles_select on public.clinical_profiles for select
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'));
create policy clinical_profiles_insert on public.clinical_profiles for insert
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'));
create policy clinical_profiles_update on public.clinical_profiles for update
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'))
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'));

-- Notas: leer y AGREGAR; sin política de update ni delete (no se pueden cambiar).
drop policy if exists clinical_notes_select on public.clinical_notes;
drop policy if exists clinical_notes_insert on public.clinical_notes;
create policy clinical_notes_select on public.clinical_notes for select
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'));
create policy clinical_notes_insert on public.clinical_notes for insert
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'));

revoke all on public.clinical_profiles, public.clinical_notes from anon;
revoke update, delete on public.clinical_notes from authenticated;
-- El consentimiento no se reescribe: fecha, forma y quién lo registró quedan fijos.
revoke update on public.clinical_profiles from authenticated;
grant update (reason, allergies, conditions, medications, notes, updated_at) on public.clinical_profiles to authenticated;

-- Ficha y notas son de un paciente (y una cita) de la MISMA organización.
create or replace function public.clinical_same_org() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.organization_id = new.organization_id) then
    raise exception 'clinical_client_org_mismatch';
  end if;
  if tg_table_name = 'clinical_notes' and new.appointment_id is not null
     and not exists (select 1 from public.appointments a where a.id = new.appointment_id and a.organization_id = new.organization_id and a.client_id = new.client_id) then
    raise exception 'clinical_appointment_mismatch';
  end if;
  return new;
end $$;
revoke execute on function public.clinical_same_org() from public, anon, authenticated;
drop trigger if exists clinical_profiles_same_org on public.clinical_profiles;
create trigger clinical_profiles_same_org before insert or update on public.clinical_profiles for each row execute function public.clinical_same_org();
drop trigger if exists clinical_notes_same_org on public.clinical_notes;
create trigger clinical_notes_same_org before insert on public.clinical_notes for each row execute function public.clinical_same_org();

alter table public.client_reminders drop constraint if exists client_reminders_source_check;
alter table public.client_reminders
  add constraint client_reminders_source_check check (source in ('manual', 'service', 'vaccine', 'membership', 'clinical'));

-- La ficha tampoco se borra desde el panel (se va solo si se borra al paciente).
revoke delete on public.clinical_profiles from authenticated;
