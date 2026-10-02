-- =====================================================================
-- Modo de la recepcionista por organización.
--
--   'reception' (todas)  → agenda citas del negocio, como siempre.
--   'sales'              → la organización de ChatVenti que atiende a
--                          PROSPECTOS en sus propias redes: responde con el
--                          asesor de ventas (el mismo cerebro del widget de la
--                          página), no agenda nada.
--
--   La columna NO es escribible por sesiones de usuario (la tabla tiene
--   permisos por columna desde 20261003090000): la fija ChatVenti por SQL.
--   Si lo fuera, cualquier negocio podría convertir a su recepcionista en
--   vendedora de ChatVenti con una petición a la API.
-- =====================================================================
alter table public.organizations
  add column if not exists agent_mode text not null default 'reception'
  check (agent_mode in ('reception', 'sales'));
