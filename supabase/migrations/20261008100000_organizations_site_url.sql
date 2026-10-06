-- Página web del negocio (la del socio, p. ej. negocio.pasen.mx, o la propia).
-- Si existe, las reservas se hacen ahí con el widget y el enlace suelto
-- chatventi.com/r/<slug> pasa a segundo plano. La escribe el socio por su API
-- (service_role); el dueño NO la edita: sin grant de update para authenticated.
alter table public.organizations
  add column if not exists site_url text
  check (site_url is null or (length(site_url) <= 300 and site_url ~ '^https?://'));
comment on column public.organizations.site_url is 'Página web del negocio (socio o propia). Con ella, el widget manda; sin ella, se comparte chatventi.com/r/<slug>.';
