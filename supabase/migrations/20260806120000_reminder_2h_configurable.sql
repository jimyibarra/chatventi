-- Fase 0 (coste Meta oct-2026): el recordatorio de 2 h pasa a ser opcional
-- por negocio. Nace ENCENDIDO (true) para no cambiar el comportamiento de
-- nadie: apagarlo es una decisión del dueño cuando cada mensaje cueste dinero.
--
-- El cron (appointment-reminders) tolera que esta columna no exista todavía:
-- si la consulta falla, asume true para todos (comportamiento de siempre).
alter table public.agent_configs
  add column if not exists reminder_2h boolean not null default true;

comment on column public.agent_configs.reminder_2h is
  'Enviar el recordatorio de 2 h antes de la cita. El de 24 h siempre se envía. Default true; apagarlo ahorra un mensaje de WhatsApp por cita desde oct-2026.';
