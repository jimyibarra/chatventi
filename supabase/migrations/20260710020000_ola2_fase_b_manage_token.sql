-- Ola 2 Fase B: enlace mágico por cita (/c/[token]).
-- El cliente final ve/confirma/cancela/reagenda su cita SIN login: el token
-- opaco (uuid v4, 128 bits) ES la autorización. 404 genérico si no existe.

alter table public.appointments
  add column if not exists manage_token uuid not null default gen_random_uuid();

alter table public.appointments
  add column if not exists confirmed_by_client_at timestamptz;

create unique index if not exists appointments_manage_token_key
  on public.appointments (manage_token);

-- ---------------------------------------------------------------
-- Helper interno (NO expuesto por la API): token -> appointment id
-- ---------------------------------------------------------------
create or replace function public._resolve_token_appointment(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  select id into v_id from public.appointments where manage_token = p_token;
  if v_id is null then
    raise exception 'not_found';
  end if;
  return v_id;
end;
$$;

revoke all on function public._resolve_token_appointment(uuid) from public;
revoke execute on function public._resolve_token_appointment(uuid) from anon, authenticated;

-- ---------------------------------------------------------------
-- Lectura pública por token (para la página /c/[token])
-- ---------------------------------------------------------------
create or replace function public.get_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', a.id,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'confirmed_by_client_at', a.confirmed_by_client_at,
      'can_manage', (a.status in ('scheduled', 'confirmed') and a.starts_at > now())
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes))
      from public.appointment_services aps
      join public.service_catalogs s on s.id = aps.service_id
      where aps.appointment_id = a.id
    ), '[]'::jsonb),
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone),
    'org', jsonb_build_object('name', o.name)
  )
    into v
    from public.appointments a
    join public.branches b on b.id = a.branch_id
    join public.organizations o on o.id = a.organization_id
   where a.manage_token = p_token;

  return v; -- null si el token no existe (la página responde 404 genérico)
end;
$$;

-- ---------------------------------------------------------------
-- Acciones públicas por token
-- ---------------------------------------------------------------
create or replace function public.confirm_appointment_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  v_id := public._resolve_token_appointment(p_token);
  update public.appointments
     set status = 'confirmed',
         confirmed_by_client_at = now()
   where id = v_id
     and status in ('scheduled', 'confirmed')
     and starts_at > now();
  if not found then
    raise exception 'not_actionable';
  end if;
end;
$$;

create or replace function public.cancel_appointment_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  v_id := public._resolve_token_appointment(p_token);
  update public.appointments
     set status = 'cancelled'
   where id = v_id
     and status in ('scheduled', 'confirmed')
     and starts_at > now();
  if not found then
    raise exception 'not_actionable';
  end if;
end;
$$;

create or replace function public.reschedule_appointment_by_token(
  p_token uuid,
  p_new_starts_at timestamptz
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id     uuid;
  v_status text;
  v_starts timestamptz;
begin
  v_id := public._resolve_token_appointment(p_token);
  select status, starts_at into v_status, v_starts
    from public.appointments where id = v_id;
  if v_status not in ('scheduled', 'confirmed') or v_starts <= now()
     or p_new_starts_at <= now() then
    raise exception 'not_actionable';
  end if;
  -- Reusa el motor con lock anti-solape de Fase 2.
  perform public.reschedule_appointment(v_id, p_new_starts_at, null);
end;
$$;

-- ---------------------------------------------------------------
-- Para el AGENTE (webhook anon): obtener el token de gestión de una cita
-- del cliente actual, con la MISMA validación de propiedad del chat.
-- ---------------------------------------------------------------
create or replace function public.get_manage_token_from_chat(
  p_channel_type text,
  p_external_id text,
  p_client_phone text,
  p_appointment_id uuid
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._resolve_chat_appointment(
    p_channel_type, p_external_id, p_client_phone, p_appointment_id);
  return (select manage_token from public.appointments where id = p_appointment_id);
end;
$$;

-- Grants explícitos (gotcha de default privileges de Supabase):
-- las *_by_token y la de chat son públicas POR DISEÑO (el token/el canal autorizan).
revoke all on function public.get_appointment_by_token(uuid) from public;
grant execute on function public.get_appointment_by_token(uuid) to anon, authenticated, service_role;

revoke all on function public.confirm_appointment_by_token(uuid) from public;
grant execute on function public.confirm_appointment_by_token(uuid) to anon, authenticated, service_role;

revoke all on function public.cancel_appointment_by_token(uuid) from public;
grant execute on function public.cancel_appointment_by_token(uuid) to anon, authenticated, service_role;

revoke all on function public.reschedule_appointment_by_token(uuid, timestamptz) from public;
grant execute on function public.reschedule_appointment_by_token(uuid, timestamptz) to anon, authenticated, service_role;

revoke all on function public.get_manage_token_from_chat(text, text, text, uuid) from public;
grant execute on function public.get_manage_token_from_chat(text, text, text, uuid) to anon, authenticated, service_role;
