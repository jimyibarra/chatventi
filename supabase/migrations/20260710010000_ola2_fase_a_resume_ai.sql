-- Ola 2 Fase A: reanudar la IA de una conversación (quitar la pausa).
-- pause_ai clampa a mínimo 1 minuto, así que hace falta una RPC explícita.

create or replace function public.resume_ai(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.conversations where id = p_conversation_id;
  if v_org is null then raise exception 'conversation_not_found'; end if;
  perform public.assert_org_access(v_org);
  update public.conversations
     set ai_paused_until = null
   where id = p_conversation_id;
end;
$$;

-- Gotcha de grants por defecto de Supabase: solo authenticated (y service_role).
revoke all on function public.resume_ai(uuid) from public;
revoke execute on function public.resume_ai(uuid) from anon;
grant execute on function public.resume_ai(uuid) to authenticated, service_role;
