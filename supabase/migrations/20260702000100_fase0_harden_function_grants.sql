-- Fase 0 · Hardening: los helpers de tenancy y el onboarding no deben ser
-- ejecutables por anon. authenticated conserva EXECUTE (las politicas RLS los
-- evaluan como el usuario autenticado).
revoke execute on function public.get_my_org()    from anon, public;
revoke execute on function public.get_my_role()   from anon, public;
revoke execute on function public.get_my_branch() from anon, public;
grant  execute on function public.get_my_org()    to authenticated;
grant  execute on function public.get_my_role()   to authenticated;
grant  execute on function public.get_my_branch() to authenticated;

revoke execute on function public.create_organization_with_owner(text, text, text) from anon, public;
grant  execute on function public.create_organization_with_owner(text, text, text) to authenticated;
