-- Marca por socio (nivel 2 de marca blanca): el panel, los correos y las
-- páginas públicas de sus negocios usan su nombre, logos, colores y dominio.
alter table public.partners
  add column if not exists display_name   text,
  add column if not exists logo_url       text,
  add column if not exists logo_white_url text,
  add column if not exists icon_url       text,
  add column if not exists primary_color  text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists accent_color   text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists support_email  text,
  add column if not exists panel_url      text,
  add column if not exists app_domain     text unique,
  add column if not exists email_from     text;
comment on column public.partners.app_domain is 'Host del panel con marca del socio (agenda.pasen.mx). Los pases de entrada apuntan ahí.';
