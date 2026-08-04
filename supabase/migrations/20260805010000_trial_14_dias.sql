-- =====================================================================
-- Prueba gratis: 10 → 14 días (decisión de negocio, 2026-08-05)
--
-- El número vive en DOS sitios y tienen que coincidir:
--   · TRIAL_DAYS en src/features/billing/plans.ts (lo que promete la web)
--   · el `interval` de create_organization_with_owner, que es quien SELLA
--     organizations.trial_ends_at al crear la organización.
-- Si solo se cambia el de arriba, la web promete 14 días y el trial dura 10.
--
-- Igual que con get_agent_context, las funciones se PARCHEAN a partir de su
-- definición viva, no se reemplazan por una copia del repo. Existen v1 y v2:
-- la v1 sigue viva a propósito (retirarla es un CONTRACT posterior), así que
-- se parchean LAS DOS si están presentes.
-- =====================================================================

do $do$
declare
  v_fn record;
  v_src text;
  v_patched text;
  v_tocadas int := 0;
begin
  for v_fn in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('create_organization_with_owner', 'create_organization_with_owner_v2')
  loop
    v_src := pg_get_functiondef(v_fn.sig);

    if position('interval ''10 days''' in v_src) = 0 then
      raise notice 'Sin cambios en % (no contiene el intervalo de 10 días)', v_fn.sig;
      continue;
    end if;

    v_patched := replace(v_src, 'interval ''10 days''', 'interval ''14 days''');
    execute v_patched;
    v_tocadas := v_tocadas + 1;
    raise notice 'Trial actualizado a 14 días en %', v_fn.sig;
  end loop;

  if v_tocadas = 0 then
    raise notice 'Ninguna función necesitaba cambio (¿ya estaban a 14 días?)';
  end if;
end
$do$;

-- ---------------------------------------------------------------------
-- Backfill de las pruebas EN CURSO, para que nadie se quede con 10 días
-- después de que la web empiece a prometer 14.
--
-- El filtro es deliberadamente estrecho: solo filas cuyo trial_ends_at sea
-- EXACTAMENTE created_at + 10 días, es decir, las selladas por la versión
-- anterior. Así se deja en paz:
--   · la org demo de la landing, con centinela trial_ends_at = 2099-01-01,
--   · cualquier trial extendido a mano.
-- ---------------------------------------------------------------------
update public.organizations
   set trial_ends_at = created_at + interval '14 days'
 where trial_ends_at = created_at + interval '10 days'
   and trial_ends_at > now();
