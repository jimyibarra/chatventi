-- La agenda pública muestra el precio como lo escribió el dueño en el socio
-- (price_text) y respeta el orden del catálogo (sort_order).
create or replace function public.get_public_booking_context(p_slug text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_result jsonb;
begin
  select id into v_org from public.organizations where web_slug = p_slug limit 1;
  if v_org is null then return null; end if;

  select b.id into v_branch
    from public.branches b where b.organization_id = v_org order by b.created_at limit 1;

  select jsonb_build_object(
    'org', (select jsonb_build_object('name', o.name, 'branding', o.branding)
              from public.organizations o where o.id = v_org),
    'branch', (select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
                 from public.branches b where b.id = v_branch),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'price_text', s.price_text, 'description', s.description)
        order by s.sort_order, s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price,
        'image_url', p.image_url, 'description', p.description) order by p.name)
      from public.products p where p.organization_id = v_org and p.active), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'photo_url', r.photo_url,
        -- Lista vacia = presta TODOS los servicios (regla del motor, Fase 2).
        'service_ids', coalesce((
          select jsonb_agg(rs.service_id)
            from public.resource_services rs where rs.resource_id = r.id
        ), '[]'::jsonb)
      ) order by r.sort_order, r.name)
      from public.resources r
      where r.organization_id = v_org
        and r.active
        and (r.branch_id is null or r.branch_id = v_branch)
        and exists (
          select 1 from public.staff_schedules ss
           where ss.resource_id = r.id and ss.branch_id = v_branch
        )
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
