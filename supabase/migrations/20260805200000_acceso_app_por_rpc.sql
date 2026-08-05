-- Arregla: el PERSONAL quedaba bloqueado en los negocios que PAGAN.
--
-- `proxy.ts` decidía el acceso leyendo `organizations` y `subscriptions`
-- directamente desde la sesión del usuario, así que la RLS mandaba. Y la policy
-- `sub_select` solo deja ver la suscripción a `owner` y `manager`: un usuario
-- `staff` recibía CERO filas, el código concluía "no hay suscripción" y el
-- acceso pasaba a depender solo de la prueba gratis. En cuanto la prueba vencía,
-- todo el personal de un negocio con suscripción activa se quedaba fuera con el
-- cartel "Tu prueba gratis terminó" (verificado en producción el 2026-08-05).
--
-- La decisión de acceso no puede depender de lo que cada ROL puede LEER. Se
-- mueve a una función SECURITY DEFINER que responde lo mismo para todos los
-- miembros de la organización y NO expone ningún dato de facturación: solo
-- devuelve un veredicto.
--
-- Criterio de suscripción: se conserva EXACTAMENTE el que ya aplicaba el proxy
-- para el dueño (status in ('trialing','active')). A propósito NO se añade la
-- comprobación de `current_period_end` que hace `org_is_active`: endurecerlo
-- aquí cambiaría a quién se le corta el acceso, que no es lo que se está
-- arreglando, y podría dejar fuera a alguien que sí paga si el webhook va con
-- retraso.

create or replace function public.my_app_access()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_org   uuid;
  v_trial timestamptz;
  v_sub   boolean;
begin
  select p.organization_id into v_org
    from public.profiles p
   where p.id = auth.uid();

  -- Sin organización todavía (super_admin, o perfil recién creado): que decida
  -- el proxy; aquí no hay nada que cobrar.
  if v_org is null then
    return 'sin_org';
  end if;

  select o.trial_ends_at into v_trial
    from public.organizations o
   where o.id = v_org;

  select exists (
    select 1 from public.subscriptions s
     where s.organization_id = v_org
       and s.status in ('trialing', 'active')
  ) into v_sub;

  if v_sub or (v_trial is not null and v_trial > now()) then
    return 'con_acceso';
  end if;

  return 'bloqueado';
end;
$$;

-- Grants: las DOS fuentes de permiso (aprendizaje 2026-08-05). La llama un
-- usuario con sesión, así que `authenticated` sí la necesita; `anon` no.
revoke execute on function public.my_app_access() from public, anon;
grant  execute on function public.my_app_access() to authenticated, service_role;
