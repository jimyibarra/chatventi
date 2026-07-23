-- CRM #4: overview con segmentación derivada + upsert para import CSV.

-- get_crm_overview: INVOKER a propósito — la RLS de clients/appointments/
-- client_records/tags ya aísla por org, así que el caller solo ve lo suyo y no
-- hay forma de pedir otra org. Segmento y "inactivo" se CALCULAN, no se guardan.
create or replace function public.get_crm_overview()
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare v_result jsonb;
begin
  with base as (
    select c.id, c.name, c.phone, c.created_at,
      coalesce(a.cnt, 0)          as appt_count,
      a.last_visit,
      coalesce(a.has_future, false) as has_future,
      coalesce(r.spent, 0)        as spent
    from public.clients c
    left join lateral (
      select count(*) as cnt,
             max(ap.starts_at) filter (where ap.starts_at <= now()) as last_visit,
             bool_or(ap.starts_at > now()) as has_future
      from public.appointments ap
      where ap.client_id = c.id
        and ap.status in ('scheduled','confirmed','completed')
    ) a on true
    left join lateral (
      select sum(cr.amount) as spent
      from public.client_records cr where cr.client_id = c.id
    ) r on true
    where coalesce(c.phone, '') not like 'sandbox:%'
  ),
  seg as (
    select b.*,
      case when b.appt_count >= 5 then 'vip'
           when b.appt_count >= 2 then 'regular'
           else 'nuevo' end as segment,
      (b.appt_count >= 1 and not b.has_future
        and (b.last_visit is null or b.last_visit < now() - interval '60 days')) as inactive
    from base b
  )
  select jsonb_build_object(
    'stats', (
      select jsonb_build_object(
        'total',    count(*),
        'nuevo',    count(*) filter (where segment = 'nuevo'),
        'regular',  count(*) filter (where segment = 'regular'),
        'vip',      count(*) filter (where segment = 'vip'),
        'inactive', count(*) filter (where inactive)
      ) from seg
    ),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'phone', s.phone,
        'created_at', s.created_at,
        'appt_count', s.appt_count,
        'last_visit', s.last_visit,
        'spent', s.spent,
        'segment', s.segment,
        'inactive', s.inactive,
        'tags', coalesce((
          select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) order by t.name)
          from public.client_tags ct join public.tags t on t.id = ct.tag_id
          where ct.client_id = s.id
        ), '[]'::jsonb)
      ) order by s.appt_count desc, s.last_visit desc nulls last, s.created_at desc)
      from seg s
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

-- upsert_client_manual: para el import de CSV. DEFINER para setear org y hacer
-- el upsert por canónico reusando normalize_phone_mx. NO pisa el nombre con
-- vacío. Devuelve 'inserted' | 'updated' | 'invalid'.
create or replace function public.upsert_client_manual(p_name text, p_phone text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org   uuid;
  v_canon text;
  v_name  text;
  v_id    uuid;
begin
  v_org := public.get_my_org();
  if v_org is null then return 'invalid'; end if;

  if p_phone is null or btrim(p_phone) = '' then return 'invalid'; end if;
  v_canon := public.normalize_phone_mx(p_phone);
  if v_canon is null or v_canon = '' then return 'invalid'; end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');

  select id into v_id from public.clients
    where organization_id = v_org and phone_canonical = v_canon
    limit 1;

  if v_id is not null then
    update public.clients set name = coalesce(v_name, name) where id = v_id;
    return 'updated';
  end if;

  begin
    insert into public.clients(organization_id, name, phone, phone_canonical)
    values (v_org, v_name, btrim(p_phone), v_canon);
    return 'inserted';
  exception when unique_violation then
    update public.clients set name = coalesce(v_name, name)
      where organization_id = v_org and phone_canonical = v_canon;
    return 'updated';
  end;
end;
$function$;

revoke execute on function public.upsert_client_manual(text, text) from anon;
