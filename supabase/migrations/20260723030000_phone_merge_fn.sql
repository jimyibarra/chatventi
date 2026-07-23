-- =====================================================================
-- ChatVenti · Teléfonos · Función de fusión de duplicados por canónico
--   Superviviente: el que tenga nombre; empate -> el más antiguo.
--   Repunta citas/etiquetas/conversaciones/nombre/notas y borra el resto.
--   Idempotente: si no hay grupos duplicados, no hace nada.
-- =====================================================================
create or replace function public.merge_duplicate_clients()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g          record;
  v_survivor uuid;
  v_dup      uuid;
  v_groups   int := 0;
  v_merged   int := 0;
begin
  for g in
    select organization_id,
           phone_canonical,
           array_agg(id order by (name is not null) desc, created_at) as ids
      from public.clients
     where phone_canonical is not null
     group by organization_id, phone_canonical
    having count(*) > 1
  loop
    v_groups := v_groups + 1;
    v_survivor := g.ids[1];  -- con nombre primero; empate -> más antiguo

    foreach v_dup in array g.ids[2:array_length(g.ids, 1)] loop
      -- Citas del duplicado -> superviviente
      update public.appointments set client_id = v_survivor where client_id = v_dup;

      -- Etiquetas: evitar duplicar (PK client_id,tag_id) y luego mover
      delete from public.client_tags ct
       where ct.client_id = v_dup
         and exists (select 1 from public.client_tags s
                      where s.client_id = v_survivor and s.tag_id = ct.tag_id);
      update public.client_tags set client_id = v_survivor where client_id = v_dup;

      -- Conversaciones EN COLISIÓN (el superviviente ya tiene una en ese canal):
      -- mover mensajes y aprobaciones, luego borrar la del duplicado.
      update public.messages m
         set conversation_id = sc.id
        from public.conversations dc
        join public.conversations sc
          on sc.client_id = v_survivor and sc.channel_id = dc.channel_id
       where m.conversation_id = dc.id and dc.client_id = v_dup;
      update public.ai_approvals ap
         set conversation_id = sc.id
        from public.conversations dc
        join public.conversations sc
          on sc.client_id = v_survivor and sc.channel_id = dc.channel_id
       where ap.conversation_id = dc.id and dc.client_id = v_dup;
      delete from public.conversations dc
       where dc.client_id = v_dup
         and exists (select 1 from public.conversations sc
                      where sc.client_id = v_survivor and sc.channel_id = dc.channel_id);
      -- Conversaciones SIN colisión -> repuntar al superviviente
      update public.conversations set client_id = v_survivor where client_id = v_dup;

      -- Nombre y notas al superviviente
      update public.clients s
         set name  = coalesce(s.name, d.name),
             notes = case
                       when coalesce(s.notes, '') = '' then d.notes
                       when coalesce(d.notes, '') = '' then s.notes
                       else s.notes || E'\n' || d.notes
                     end
        from public.clients d
       where s.id = v_survivor and d.id = v_dup;

      delete from public.clients where id = v_dup;
      v_merged := v_merged + 1;
    end loop;
  end loop;

  return jsonb_build_object('groups', v_groups, 'merged', v_merged);
end;
$$;
