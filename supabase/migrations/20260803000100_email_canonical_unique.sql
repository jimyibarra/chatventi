-- =====================================================================
-- ChatVenti · Registro corto + Antiabuso · FASE 1 (cierre)
--
-- Índice ÚNICO sobre el correo canónico: una bandeja de entrada = una
-- cuenta. Con esto, juan+1@gmail.com ya no puede abrir una segunda prueba
-- gratis sobre la misma bandeja que juan@gmail.com.
--
-- Va en migración APARTE a propósito: un índice único puede fallar por
-- datos preexistentes y tumbar el despliegue entero. Antes de crearlo se
-- comprobó en producción (2026-08-03) que no hay colisiones:
--   perfiles_total = 7 · con_canon = 7 · grupos_duplicados = 0
--
-- Si en el futuro fallara, la consulta que las encuentra es:
--   select canonical_email(email), count(*) from public.profiles
--    where email is not null group by 1 having count(*) > 1;
-- =====================================================================

create unique index if not exists profiles_email_canonical_key
  on public.profiles (email_canonical)
  where email_canonical is not null;

-- El índice no único de la migración anterior queda cubierto por este.
drop index if exists public.profiles_email_canonical_idx;
