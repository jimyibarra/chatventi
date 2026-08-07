-- PRP canales Meta · Fase 1 EXPAND (aditivo). APLICADA en prod 2026-08-07 vía
-- MCP en dos partes (canales_meta_fase1_expand + canales_meta_source_ig_messenger).
-- Verificado: client_canonical('instagram', X) intacto; whatsapp sigue
-- normalizando (regresión); create_appointment_from_chat_v2 mapea ig/ms.
alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels add constraint channels_type_check
  check (type in ('whatsapp','telegram','web','instagram','messenger'));

alter table public.appointments drop constraint if exists appointments_source_check;
alter table public.appointments add constraint appointments_source_check
  check (source in ('staff','whatsapp','telegram','web','ai','instagram','messenger'));

-- Los handles de IG (IGSID) y Messenger (PSID) NO son teléfonos.
create or replace function public.client_canonical(p_channel_type text, raw text)
returns text language plpgsql immutable set search_path = public as $$
begin
  if raw is null then return null; end if;
  if raw like 'sandbox:%' then return raw; end if;
  if p_channel_type in ('telegram','instagram','messenger') then return raw; end if;
  return public.normalize_phone_mx(raw);
end;
$$;

-- Cita agendada desde IG/Messenger con su source real (parche in situ de la
-- función viva: solo cambia el case de p_channel_type, idempotente).
do $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_appointment_from_chat_v2';
  if src is null then raise exception 'funcion no encontrada'; end if;
  if position('when ''instagram''' in src) > 0 then return; end if;
  src := replace(src,
    'when ''telegram'' then ''telegram'' else ''ai'' end',
    'when ''telegram'' then ''telegram'' when ''instagram'' then ''instagram'' when ''messenger'' then ''messenger'' else ''ai'' end');
  execute src;
end $$;