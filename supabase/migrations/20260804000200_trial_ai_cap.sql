-- =====================================================================
-- ChatVenti · Antiabuso · FASE 4: tope de consumo de IA en la prueba gratis
--
-- Por qué: hasta ahora una cuenta en prueba podía consumir OpenRouter sin
-- límite. El coste real del abuso no son las cuentas basura (una cuenta que
-- no manda mensajes cuesta cero), es el consumo. Con un tope, reciclar
-- cuentas deja de ser rentable aunque alguien logre crearlas.
--
-- SOLO aplica a organizaciones SIN suscripción de IA vigente. Un cliente que
-- paga no se toca aquí: los límites de su plan son otra conversación.
-- =====================================================================

-- Exención explícita del tope. La necesita la organización DEMO que alimenta
-- el chat de la landing: no tiene suscripción, así que sin esto el tope la
-- alcanzaría y el chat público de la web se apagaría solo. Columna y no
-- constante en el código: se audita mirando la tabla.
alter table public.organizations
  add column if not exists ai_cap_exempt boolean not null default false;

comment on column public.organizations.ai_cap_exempt is
  'true = no se le aplica el tope de IA de la prueba gratis (org demo de la landing).';

create or replace function public.consume_trial_ai_message(
  p_org uuid,
  p_cap int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
  v_has_ai boolean;
  v_exempt boolean;
begin
  if p_org is null or coalesce(p_cap, 0) <= 0 then
    -- Sin datos para decidir: se permite. Este NO es un gate de seguridad,
    -- es un tope de coste; bloquear la atención real a un cliente final por
    -- un parámetro ausente sería mucho peor que gastar unos tokens de más.
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'sin_datos');
  end if;

  -- Exenta (org demo de la landing): no se cuenta ni se limita.
  select coalesce(ai_cap_exempt, false) into v_exempt
    from public.organizations where id = p_org;
  if coalesce(v_exempt, false) then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'exenta');
  end if;

  -- ¿Tiene el módulo de IA contratado y vigente? Misma condición que
  -- org_has_ai (subscriptions trialing/active con ai_tier <> 'none').
  select exists (
    select 1 from public.subscriptions s
     where s.organization_id = p_org
       and s.status in ('trialing','active')
       and s.ai_tier <> 'none'
       and (s.current_period_end is null or s.current_period_end > now())
  ) into v_has_ai;

  if v_has_ai then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'suscripcion_vigente');
  end if;

  -- Incremento ATÓMICO: update ... returning en una sola sentencia. Con dos
  -- mensajes simultáneos, un "leer y luego escribir" dejaría pasar ambos en
  -- el límite exacto.
  update public.organizations
     set trial_ai_messages_used = coalesce(trial_ai_messages_used, 0) + 1,
         trial_ai_capped_at = case
           when coalesce(trial_ai_messages_used, 0) + 1 > p_cap
                and trial_ai_capped_at is null then now()
           else trial_ai_capped_at
         end
   where id = p_org
   returning trial_ai_messages_used into v_used;

  if v_used is null then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'org_inexistente');
  end if;

  return jsonb_build_object(
    'allowed', v_used <= p_cap,
    'counted', true,
    'used', v_used,
    'cap', p_cap
  );
end;
$$;

comment on function public.consume_trial_ai_message(uuid, int) is
  'Cuenta un mensaje de IA de la prueba gratis y dice si se permite. No '
  'cuenta a organizaciones con suscripcion de IA vigente. El tope vive en '
  'src/shared/security/limits.ts y se pasa como parametro para no duplicar '
  'la constante en dos sitios.';

revoke all on function public.consume_trial_ai_message(uuid, int) from public;
revoke execute on function public.consume_trial_ai_message(uuid, int) from anon;
-- Solo service_role: la llama el motor del agente en el servidor. anon no
-- debe poder inflar el contador de una organizacion ajena.
grant execute on function public.consume_trial_ai_message(uuid, int) to service_role;

-- Exime a la organización que alimenta el chat público de la landing. Se
-- localiza por su CANAL ('demo-landing') y no por un id escrito a mano: si
-- algún día se recrea la demo, esto la sigue encontrando y no deja el chat
-- de la web apagándose solo al llegar al tope.
update public.organizations o
   set ai_cap_exempt = true
 where exists (
   select 1 from public.channels c
    where c.organization_id = o.id
      and c.external_id = 'demo-landing'
 );
