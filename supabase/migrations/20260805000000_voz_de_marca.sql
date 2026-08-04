-- =====================================================================
-- Voz de marca (PRP prp-verticales-seo.md · Fase 3)
--
-- La parte 2 modifica public.get_agent_context, que usan los webhooks de
-- WhatsApp y Telegram EN PRODUCCIÓN. NO se reescribe con una copia del cuerpo:
-- se PARCHEA la definición viva leída con pg_get_functiondef.
--
-- Por qué: copiar el cuerpo desde el archivo de migración da por hecho que la
-- base es lo que dice el repo. Si hubiera derivado, un "create or replace"
-- revertiría en silencio cualquier cambio posterior. Así se rompió la reagenda
-- en la Fase 7 CONTRACT: DDL en verde, funcionalidad rota.
--
-- El parche es idempotente (si ya expone la voz, no hace nada) y ABORTA si no
-- encuentra el ancla exacta, en vez de dejar la función a medias.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas de voz en agent_configs
--
-- La voz vive AQUÍ y no en organizations.branding por tres razones:
--   · branding se devuelve ENTERO en RPC públicas (get_public_org_by_slug,
--     el token de cita, los correos) → filtraría configuración interna;
--   · branding es un jsonb con >=2 escritores que hacen merge a mano, y cada
--     escritor nuevo es otra ocasión de borrar el logo o resource_label;
--   · system_prompt ya tiene dueño: applyBusinessTemplate lo SOBRESCRIBE, así
--     que aplicar una plantilla de rubro habría borrado la voz.
-- ---------------------------------------------------------------------
alter table public.agent_configs
  add column if not exists voice_preset text
    check (voice_preset is null or voice_preset in ('calido','formal','divertido','custom')),
  add column if not exists voice_profile jsonb,
  add column if not exists voice_source_url text,
  add column if not exists voice_updated_at timestamptz;

comment on column public.agent_configs.voice_profile is
  'Retrato de voz TIPADO (treatment/energy/emoji/sentence/quirks). Se valida con Zod al escribir Y al leer: un perfil corrupto nunca debe llegar crudo al prompt.';

-- ---------------------------------------------------------------------
-- 2. get_agent_context: expone la voz dentro de `config`.
--    Se parchea la definición VIVA, no se reemplaza por una copia.
-- ---------------------------------------------------------------------
do $do$
declare
  v_src text;
  v_patched text;
  v_anchor text := '''approval_chat_id'', ac.approval_telegram_chat_id';
begin
  v_src := pg_get_functiondef('public.get_agent_context(text,text,text)'::regprocedure);

  -- Idempotente: si ya expone la voz, no hay nada que hacer.
  if position('voice_preset' in v_src) > 0 then
    raise notice 'get_agent_context ya expone la voz de marca; sin cambios';
    return;
  end if;

  v_patched := replace(
    v_src,
    v_anchor,
    v_anchor || ', ''voice_preset'', ac.voice_preset, ''voice_profile'', ac.voice_profile'
  );

  -- Si el ancla no está, la función viva NO es la que esperábamos: abortar sin
  -- tocar nada es mucho mejor que dejarla a medias.
  if v_patched = v_src then
    raise exception 'No se encontró el ancla en get_agent_context. Abortado sin modificar nada.';
  end if;

  execute v_patched;
  raise notice 'get_agent_context parcheada: config ahora incluye voice_preset y voice_profile';
end
$do$;
