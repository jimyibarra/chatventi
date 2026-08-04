-- =====================================================================
-- ChatVenti · Registro corto · FASE 2
--
-- ¿Existe ya una cuenta para esta bandeja de entrada?
--
-- Mira auth.users, NO profiles: entre el alta y el asistente de bienvenida
-- hay un hueco (correo sin verificar todavía) en el que existe el usuario
-- pero aún no su perfil. Comprobando solo profiles, juan+2@gmail.com pasaría
-- el alta y reventaría después contra el índice único, ya con el correo
-- verificado — el peor momento posible para decirle que no.
--
-- 🔴 PERMISOS: se otorga SOLO a service_role. Expuesta a anon sería un
-- enumerador de usuarios (cualquiera podría comprobar si un correo tiene
-- cuenta). La Server Action del alta corre en el servidor y la llama con el
-- cliente de servicio; el navegador nunca puede invocarla.
-- =====================================================================

create or replace function public.email_canonical_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from auth.users u
     where public.canonical_email(u.email) = public.canonical_email(p_email)
       and public.canonical_email(p_email) is not null
  );
$$;

comment on function public.email_canonical_exists(text) is
  'true si ya hay una cuenta con esa bandeja (ignorando +etiqueta y, en '
  'Gmail, los puntos). Solo service_role: expuesta a anon permitiría '
  'enumerar usuarios.';

revoke all on function public.email_canonical_exists(text) from public;
revoke execute on function public.email_canonical_exists(text) from anon, authenticated;
grant execute on function public.email_canonical_exists(text) to service_role;
