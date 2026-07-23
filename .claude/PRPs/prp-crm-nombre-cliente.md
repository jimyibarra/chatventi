# PRP — CRM inteligente: el agente captura el nombre del cliente

> Origen: feedback de Juan sobre `Clientes.png`.

## Objetivo

Que el **recepcionista IA guarde el nombre del cliente** en su ficha del CRM cuando
lo comparte, para que la lista de Clientes muestre nombres y no puros teléfonos.

## Qué se hizo

- **RPC `set_client_name_from_chat`** (`20260723010000`, SECURITY DEFINER, anon):
  resuelve la org por canal y actualiza `clients.name` del contacto (por teléfono).
  Patrón idéntico a las demás `*_from_chat`. Ignora nombres vacíos; corta a 80 chars.
- **Tool `save_client_name`** en `runAgent`: el agente la llama en cuanto conoce el
  nombre. Funciona en todos los canales (WhatsApp/Telegram/web) y también en el sandbox.
- **Prompt:** se añade `NOMBRE DEL CLIENTE: <nombre|(desconocido)>` y una regla: saludar
  por su nombre si se conoce y NO re-pedirlo; si no, pedirlo UNA vez con amabilidad y
  guardarlo; no insistir si el cliente no lo quiere dar.
- El display ya se corrigió antes (teléfono una sola vez, nombre al inicio; commit `29214f8`).

## Validación

E2E en el sandbox (Playwright + SQL): al escribir "Hola, soy Pedro Ramírez…", el agente
respondió "Hola, Pedro…" y `clients.name` quedó = "Pedro Ramírez". typecheck+lint+build
verdes.

## Análisis abierto (NO incluido aquí a propósito): teléfonos duplicados

Se detectó que un mismo cliente puede quedar **duplicado por formato de teléfono**: en la
org de prueba, "Juan" está como `5521410491` (nacional, 10 díg.) y también como
`5215521410491` (WhatsApp: `521` + número). Son la misma persona en dos filas.

**Por qué no se corrige aquí:** normalizar teléfonos es **delicado y depende del país**
(reglas MX `521`/`52`, otros países distintos), toca el **motor de WhatsApp EN VIVO**
(`route_inbound_message` + todas las `*_from_chat` que resuelven el cliente por teléfono
deberían normalizar igual, o el agente dejaría de encontrar al cliente) y además requiere
una **migración de datos para fusionar los duplicados existentes**. Hacerlo mal fusiona
personas distintas o parte a la misma. Merece un PRP propio con reglas de país confirmadas
por Juan y revalidación completa del flujo de WhatsApp.

## Fuera de alcance

- Normalización/fusión de teléfonos duplicados (PRP aparte, con confirmación de reglas).
- Historial clínico + recordatorios (PRP 4).
