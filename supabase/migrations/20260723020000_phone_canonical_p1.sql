-- =====================================================================
-- ChatVenti · Teléfonos · FASE 1 (aditiva): normalización + columna + backfill
--   Regla MX (decisión de Juan): canónico = 52 + 10 dígitos, quitando el 1 de
--   los WhatsApp MX (521...). No-MX: solo dígitos. Telegram/sandbox: sin tocar
--   (no son teléfonos; canonicalización consciente del canal).
--   No cambia comportamiento: solo agrega la columna y la rellena.
-- =====================================================================

-- Normaliza un teléfono a la forma canónica MX (solo dígitos + regla 52/521).
create or replace function public.normalize_phone_mx(raw text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare d text;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '\D', '', 'g');
  if d = '' then return raw; end if;
  if left(d, 2) = '00' then d := substr(d, 3); end if;   -- prefijo internacional
  if length(d) = 13 and left(d, 3) = '521' then
    return '52' || substr(d, 4);      -- 521 + 10  -> 52 + 10
  elsif length(d) = 12 and left(d, 2) = '52' then
    return d;                          -- 52 + 10 (ya canónico)
  elsif length(d) = 10 then
    return '52' || d;                  -- nacional 10 díg -> +52 (México)
  else
    return d;                          -- no-MX: solo dígitos limpios
  end if;
end;
$$;

-- Canónico consciente del canal: Telegram (chat id) y sandbox NO se normalizan.
create or replace function public.client_canonical(p_channel_type text, raw text)
returns text
language plpgsql immutable
set search_path = public
as $$
begin
  if raw is null then return null; end if;
  if raw like 'sandbox:%' then return raw; end if;
  if p_channel_type = 'telegram' then return raw; end if;
  return public.normalize_phone_mx(raw);
end;
$$;

-- Columna canónica (conserva `phone` original para mostrar) + índice de lookup.
alter table public.clients add column if not exists phone_canonical text;
create index if not exists clients_org_canonical_idx
  on public.clients(organization_id, phone_canonical);

-- Backfill: inferir el canal desde las conversaciones del cliente; sin
-- conversación se trata como teléfono (web).
update public.clients c
   set phone_canonical = public.client_canonical(
     coalesce((
       select ch.type
         from public.conversations conv
         join public.channels ch on ch.id = conv.channel_id
        where conv.client_id = c.id
        order by conv.created_at
        limit 1
     ), 'web'),
     c.phone
   )
 where c.phone is not null
   and c.phone_canonical is distinct from public.client_canonical(
     coalesce((
       select ch.type from public.conversations conv
       join public.channels ch on ch.id = conv.channel_id
       where conv.client_id = c.id order by conv.created_at limit 1
     ), 'web'), c.phone);
