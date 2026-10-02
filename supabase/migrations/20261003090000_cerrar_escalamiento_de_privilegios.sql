-- =====================================================================
-- 🔒 CIERRE DE UN ESCALAMIENTO DE PRIVILEGIOS (crítico, verificado en vivo)
--
--   Supabase concede por defecto TODOS los permisos de tabla a `authenticated`.
--   La RLS decide QUÉ FILAS se tocan, pero no QUÉ COLUMNAS. Con la policy
--   `profile_update_self` (id = auth.uid()) eso significaba que cualquier
--   usuario podía reescribir su propia fila ENTERA con una sola petición a la
--   API, usando su sesión normal y la anon key pública:
--
--     PATCH /rest/v1/profiles?id=eq.<yo>   { "role": "super_admin" }
--
--   Probado el 2026-10-03 con la cuenta de pruebas `staff`: la base aceptó
--   role = 'owner' (200) y lo guardó. Con 'super_admin' habría tenido el
--   panel de administración y los datos de todos los negocios.
--   Mismo defecto, mismo arreglo, en otras tres tablas:
--     · organizations  → el dueño podía alargarse la prueba (trial_ends_at)
--                        y quitarse el tope de IA (ai_cap_exempt).
--     · agent_configs  → el dueño podía elegir el modelo de IA (`model`), que
--                        paga ChatVenti. El panel decía "solo el superadmin".
--     · channels       → dueño/gerente podían escribir canales a mano (apuntar
--                        un número ajeno a su negocio) y todo el equipo podía
--                        LEER el token de acceso de WhatsApp.
--
--   ARREGLO: permisos por COLUMNA. Lo que el inquilino no debe decidir deja de
--   ser escribible para `authenticated`; las funciones SECURITY DEFINER
--   (set_member_role, create_organization_with_owner, admin_*…) corren como
--   su dueño y no se ven afectadas. Además, un disparador en `profiles` como
--   segundo candado: si alguien vuelve a conceder UPDATE a la tabla entera,
--   el rol sigue sin poder cambiarse desde la API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: el usuario solo edita sus datos de contacto.
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create or replace function public.profiles_guard_privileged_columns()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- current_user es `authenticated`/`anon` solo cuando la escritura llega
  -- directa por la API. Dentro de una función SECURITY DEFINER es su dueño.
  if current_user in ('authenticated', 'anon') and (
       new.role is distinct from old.role
    or new.organization_id is distinct from old.organization_id
    or new.is_active is distinct from old.is_active
    or new.resource_scope is distinct from old.resource_scope
    or new.assigned_branch_id is distinct from old.assigned_branch_id
  ) then
    raise exception 'No puedes cambiar tu rol ni tu organización.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- ---------------------------------------------------------------------
-- organizations: datos del negocio sí; prueba, topes y marcas de sistema no.
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.organizations from anon, authenticated;
grant update (name, branding, contact_email, phone, country, city, business_type, web_slug)
  on public.organizations to authenticated;

-- ---------------------------------------------------------------------
-- agent_configs: todo menos `model` (lo fija el superadmin por RPC).
-- El upsert de la app escribe organization_id en el SET, por eso va en ambas.
-- ---------------------------------------------------------------------
revoke insert, update, truncate on public.agent_configs from anon, authenticated;
grant insert (
  organization_id, enabled, approval_mode, approval_telegram_chat_id, system_prompt, updated_at,
  voice_preset, voice_profile, voice_source_url, voice_updated_at,
  cap_vision, cap_transcribe, cap_scoring, cap_csat, cap_cold_followup, cap_daily_report, reminder_2h
) on public.agent_configs to authenticated;
grant update (
  organization_id, enabled, approval_mode, approval_telegram_chat_id, system_prompt, updated_at,
  voice_preset, voice_profile, voice_source_url, voice_updated_at,
  cap_vision, cap_transcribe, cap_scoring, cap_csat, cap_cold_followup, cap_daily_report, reminder_2h
) on public.agent_configs to authenticated;

-- ---------------------------------------------------------------------
-- channels y subscriptions: solo escribe el servidor (service_role).
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.channels from anon, authenticated;
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;

-- channels.credentials guarda el token de acceso de WhatsApp/Meta: ninguna
-- sesión de usuario necesita leerlo. Se concede lectura columna a columna.
-- (Va DESPUÉS de desplegar el código que deja de pedir `select('*')`.)
revoke select on public.channels from anon, authenticated;
grant select (id, organization_id, type, external_id, waba_id, display_name, status, created_at)
  on public.channels to authenticated;
