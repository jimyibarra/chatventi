-- El KPI "mensajes de IA hoy" del panel (`src/features/dashboard/metrics.ts`)
-- hace un `count: 'exact'` sobre `messages` filtrando por `sender` y `created_at`,
-- y se apoya SOLO en la RLS para acotar por organización.
--
-- La policy `message_select` evalúa un EXISTS contra `conversations` fila a fila.
-- Sin este índice, con 150.000 mensajes en la tabla ese conteo tardaba 1,6 s; y
-- el mismo conteo SIN filtro de fecha agotaba el statement_timeout (error 57014).
--
-- Medido en la prueba de carga del 2026-08-05: 1.588 ms → ~815 ms desde el
-- navegador. Nota importante que el índice NO arregla: escrita con un filtro
-- explícito de organización, esa misma consulta tarda 0,95 ms en el servidor.
-- El arreglo de fondo es filtrar por organización/conversación en la aplicación
-- en vez de delegar el acotado a la RLS.
create index if not exists messages_sender_created_idx
  on public.messages (sender, created_at desc);
