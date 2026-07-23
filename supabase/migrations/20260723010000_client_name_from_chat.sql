-- =====================================================================
-- ChatVenti · CRM: el agente guarda el nombre del cliente
--   set_client_name_from_chat: el recepcionista IA la llama cuando el cliente
--   comparte su nombre, para que el CRM muestre nombres y no puros teléfonos.
--   Patrón *_from_chat: resuelve la org por canal y el cliente por teléfono.
--   SECURITY DEFINER + invocable por ANON (el webhook corre como anon).
-- =====================================================================

create or replace function public.set_client_name_from_chat(
  p_channel_type text,
  p_external_id  text,
  p_client_phone text,
  p_name         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org  uuid;
  v_name text;
begin
  v_name := nullif(btrim(p_name), '');
  if v_name is null then
    return; -- nada que guardar
  end if;
  if length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;

  -- Resolver la organización por el canal (type, external_id).
  select organization_id into v_org
    from public.channels
   where type = p_channel_type
     and external_id = p_external_id
     and status <> 'disabled'
   limit 1;
  if v_org is null then
    return;
  end if;

  -- Actualiza el nombre del contacto (upsert por telefono ya lo creó el inbound).
  update public.clients
     set name = v_name
   where organization_id = v_org
     and phone = btrim(p_client_phone);
end;
$$;

revoke all on function public.set_client_name_from_chat(text, text, text, text) from public;
grant execute on function public.set_client_name_from_chat(text, text, text, text) to anon, authenticated;
