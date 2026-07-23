-- Branding #3: la página de gestión de cita /c/[token] debe mostrar la marca
-- del NEGOCIO (logo), no solo su nombre. Se añade `branding` al org del jsonb.
-- Aditivo: solo agrega una clave al objeto; ningún llamador existente se rompe.
create or replace function public.get_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    'org', jsonb_build_object('name', o.name, 'branding', o.branding)
  )
    into v
    from public.appointments a
    join public.branches b on b.id = a.branch_id
    join public.organizations o on o.id = a.organization_id
   where a.manage_token = p_token;

  return v;
end;
$function$;
