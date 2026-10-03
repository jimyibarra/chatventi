-- =====================================================================
-- Anticipo para apartar la cita — opción A (transferencia + comprobante).
--
--   El dinero va DIRECTO a la cuenta del negocio: ChatVenti nunca lo toca.
--   El sistema solo calcula cuánto, aparta la cita un tiempo, reconoce el
--   comprobante que manda el cliente, libera el horario si no llega y decide
--   si el anticipo se retiene o se devuelve según las reglas del negocio.
--
--   Estados de `appointments.deposit_status`:
--     pending         esperando comprobante (la cita está "apartada")
--     proof_received  llegó un comprobante; falta que el negocio lo confirme
--     paid            el negocio confirmó que recibió el dinero
--     retained        se queda en el negocio (no asistió o canceló tarde)
--     refund_due      hay que devolverlo (canceló a tiempo o canceló el negocio)
--     refunded        el negocio ya lo devolvió
--     expired         no llegó a tiempo: la cita se liberó
--     void            la cita se canceló antes de pagar: no hay nada que mover
--     waived          el negocio lo perdonó
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Configuración
-- ---------------------------------------------------------------------
alter table public.service_catalogs
  add column if not exists deposit_type text not null default 'none'
    check (deposit_type in ('none', 'fixed', 'percent')),
  add column if not exists deposit_value numeric(10, 2)
    check (deposit_value is null or deposit_value > 0);

alter table public.organizations
  add column if not exists deposit_bank_details text
    check (deposit_bank_details is null or length(deposit_bank_details) <= 600),
  add column if not exists deposit_hold_minutes integer not null default 120
    check (deposit_hold_minutes between 15 and 1440),
  add column if not exists deposit_cancel_hours integer not null default 24
    check (deposit_cancel_hours between 0 and 168);

-- organizations tiene permisos por columna (20261003090000): estas tres las
-- decide el dueño, así que se conceden a propósito.
grant update (deposit_bank_details, deposit_hold_minutes, deposit_cancel_hours)
  on public.organizations to authenticated;

-- ---------------------------------------------------------------------
-- 2. Estado del anticipo en la cita
-- ---------------------------------------------------------------------
alter table public.appointments
  add column if not exists deposit_amount numeric(10, 2),
  add column if not exists deposit_status text
    check (deposit_status in ('pending', 'proof_received', 'paid', 'retained', 'refund_due', 'refunded', 'expired', 'void', 'waived')),
  add column if not exists deposit_hold_until timestamptz,
  add column if not exists deposit_proof_message_id uuid references public.messages(id) on delete set null,
  add column if not exists deposit_updated_at timestamptz;

create index if not exists appointments_deposit_pending_idx
  on public.appointments (deposit_hold_until) where deposit_status = 'pending';
create index if not exists appointments_deposit_open_idx
  on public.appointments (organization_id, deposit_status)
  where deposit_status in ('proof_received', 'refund_due');
create index if not exists appointments_deposit_proof_idx
  on public.appointments (deposit_proof_message_id) where deposit_proof_message_id is not null;

-- ---------------------------------------------------------------------
-- 3. Reglas automáticas al cambiar el estado de la cita
--    auth.uid() solo existe cuando el cambio lo hace una persona del negocio
--    desde el panel; los cambios del cliente (chat o enlace) llegan sin él.
-- ---------------------------------------------------------------------
create or replace function public.appointments_deposit_rules()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_cancel_hours integer;
begin
  if new.status is not distinct from old.status or old.deposit_status is null then
    return new;
  end if;

  if old.deposit_status in ('paid', 'proof_received') then
    if new.status = 'no_show' then
      new.deposit_status := 'retained';
    elsif new.status = 'cancelled' then
      if auth.uid() is not null then
        new.deposit_status := 'refund_due';            -- canceló el negocio
      else
        select deposit_cancel_hours into v_cancel_hours
          from public.organizations where id = new.organization_id;
        new.deposit_status := case
          when new.starts_at - now() >= make_interval(hours => coalesce(v_cancel_hours, 24)) then 'refund_due'
          else 'retained'                                 -- canceló tarde
        end;
      end if;
    end if;
  elsif old.deposit_status = 'pending' and new.status = 'cancelled' and new.deposit_status = 'pending' then
    new.deposit_status := 'void';
  end if;

  if new.deposit_status is distinct from old.deposit_status then
    new.deposit_updated_at := now();
  end if;
  return new;
end;
$function$;

revoke execute on function public.appointments_deposit_rules() from public, anon, authenticated;

drop trigger if exists appointments_deposit_rules on public.appointments;
create trigger appointments_deposit_rules
  before update of status on public.appointments
  for each row execute function public.appointments_deposit_rules();

-- ---------------------------------------------------------------------
-- 4. Al agendar por chat: ¿esta cita pide anticipo? (solo servidor)
--    Sin datos bancarios del negocio NO se pide anticipo: no se puede
--    pedir dinero sin decir a dónde mandarlo.
-- ---------------------------------------------------------------------
create or replace function public.apply_deposit_requirement(p_appointment_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_appt   record;
  v_org    record;
  v_amount numeric(10, 2);
  v_hold   timestamptz;
begin
  select a.id, a.organization_id, a.starts_at, a.status, a.deposit_status
    into v_appt from public.appointments a where a.id = p_appointment_id;
  if v_appt.id is null or v_appt.deposit_status is not null then return null; end if;

  select o.deposit_bank_details, o.deposit_hold_minutes into v_org
    from public.organizations o where o.id = v_appt.organization_id;
  if coalesce(trim(v_org.deposit_bank_details), '') = '' then return null; end if;

  select coalesce(sum(case
           when sc.deposit_type = 'fixed' then sc.deposit_value
           when sc.deposit_type = 'percent' then round(coalesce(sc.price, 0) * sc.deposit_value / 100, 2)
           else 0 end), 0)
    into v_amount
    from public.appointment_services aps
    join public.service_catalogs sc on sc.id = aps.service_id
   where aps.appointment_id = p_appointment_id;
  if v_amount <= 0 then return null; end if;

  -- Se aparta hasta lo que llegue antes: el plazo del negocio o la cita.
  v_hold := least(now() + make_interval(mins => v_org.deposit_hold_minutes), v_appt.starts_at);
  if v_hold <= now() + interval '10 minutes' then return null; end if;   -- demasiado cerca

  update public.appointments
     set deposit_amount = v_amount, deposit_status = 'pending',
         deposit_hold_until = v_hold, deposit_updated_at = now()
   where id = p_appointment_id;

  return jsonb_build_object(
    'amount', v_amount,
    'hold_until', v_hold,
    'bank_details', v_org.deposit_bank_details
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 5. Llegó una imagen o documento: ¿es el comprobante de un anticipo?
-- ---------------------------------------------------------------------
create or replace function public.register_deposit_proof(p_message_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_msg  record;
  v_appt record;
begin
  select m.id, m.conversation_id, m.direction, m.body into v_msg
    from public.messages m where m.id = p_message_id;
  if v_msg.id is null or v_msg.direction <> 'inbound' or v_msg.body not in ('[image]', '[document]') then
    return null;
  end if;

  select a.id, a.deposit_amount, a.starts_at, b.timezone, o.id as org_id, o.name as org_name
    into v_appt
    from public.conversations c
    join public.appointments a on a.client_id = c.client_id and a.organization_id = c.organization_id
    join public.branches b on b.id = a.branch_id
    join public.organizations o on o.id = a.organization_id
   where c.id = v_msg.conversation_id
     and a.deposit_status = 'pending'
     and a.status in ('scheduled', 'confirmed')
     and a.starts_at > now()
   order by a.starts_at
   limit 1
   for update of a;
  if v_appt.id is null then return null; end if;

  update public.appointments
     set deposit_status = 'proof_received', deposit_proof_message_id = p_message_id,
         deposit_updated_at = now()
   where id = v_appt.id;

  return jsonb_build_object(
    'appointment_id', v_appt.id, 'amount', v_appt.deposit_amount, 'starts_at', v_appt.starts_at,
    'tz', v_appt.timezone, 'org_id', v_appt.org_id, 'org_name', v_appt.org_name
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 6. Plazo vencido sin comprobante: se libera el horario (cada 15 min)
-- ---------------------------------------------------------------------
create or replace function public.expire_deposit_holds()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_result jsonb;
begin
  with expired as (
    update public.appointments a
       set status = 'cancelled', deposit_status = 'expired', deposit_updated_at = now()
     where a.deposit_status = 'pending'
       and a.deposit_hold_until < now()
       and a.status in ('scheduled', 'confirmed')
    returning a.id, a.organization_id, a.client_id, a.starts_at, a.branch_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'appointment_id', e.id,
           'organization_id', e.organization_id,
           'starts_at', e.starts_at,
           'tz', b.timezone,
           'org_name', o.name,
           'conversation_id', conv.id,
           'channel_type', ch.type,
           'channel_external_id', ch.external_id,
           'send_to', cl.phone
         )), '[]'::jsonb)
    into v_result
    from expired e
    join public.organizations o on o.id = e.organization_id
    join public.branches b on b.id = e.branch_id
    join public.clients cl on cl.id = e.client_id
    left join lateral (
      select c.id, c.channel_id from public.conversations c
       where c.client_id = e.client_id
       order by c.last_message_at desc nulls last limit 1
    ) conv on true
    left join public.channels ch on ch.id = conv.channel_id;
  return v_result;
end;
$function$;

revoke execute on function public.apply_deposit_requirement(uuid) from public, anon, authenticated;
revoke execute on function public.register_deposit_proof(uuid) from public, anon, authenticated;
revoke execute on function public.expire_deposit_holds() from public, anon, authenticated;
grant execute on function public.apply_deposit_requirement(uuid) to service_role;
grant execute on function public.register_deposit_proof(uuid) to service_role;
grant execute on function public.expire_deposit_holds() to service_role;
