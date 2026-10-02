# Product

<!-- impeccable:product-schema 1 -->

> Escrito el 2026-10-02 a partir del código, la memoria del proyecto y las instrucciones
> directas de Juan. No hubo ronda de preguntas (Juan pidió trabajar sin preguntar): lo marcado
> **(inferido)** sale del repositorio y no de una respuesta suya, y debe confirmarse.

## Platform

web

## Users

- **Dueños de negocios que viven de su agenda**: peluquerías, barberías, estéticas, spas,
  consultorios dentales, veterinarias y consultorios. México primero, España después.
- **Su personal**: recepción y profesionales que atienden (un peluquero, una dentista).
- No son técnicos. Usan el producto de pie, entre un cliente y otro: en el teléfono casi
  siempre, y en la computadora del mostrador cuando hay recepción **(inferido)**.
- Su trabajo: saber qué sigue hoy, quién no ha confirmado, qué chat necesita una respuesta
  humana, y encontrar un hueco libre para agendar a alguien.

## Product Purpose

ChatVenti es una recepcionista con inteligencia artificial más la agenda del negocio. Contesta
al instante por WhatsApp (también Telegram y un widget web), agenda, reagenda, cancela,
confirma y recuerda citas, y lleva la ficha de cada cliente. Éxito: el dueño deja de perder
citas por no contestar a tiempo y no tiene que estar pegado al teléfono.

## Positioning

Agenda y recepcionista IA en un solo producto, sobre la API oficial de Meta. La IA no es un
chatbot genérico: solo actúa sobre la agenda real del negocio (huecos, servicios,
profesionales) y pasa el chat a un humano cuando no debe decidir sola.

## Operating Context

- Secciones del producto: Panel, Agenda, Chats, Clientes, Profesionales, Equipo,
  Recepcionista IA, Reservas web, Conexiones, Facturación.
- Roles: dueño, administrador, recepción, profesional. No todos ven todas las secciones.
- Estados de una cita: agendada (sin confirmar), confirmada, en curso, atendida, no asistió,
  cancelada.
- Cada cita tiene cliente, servicio con duración, profesional y origen (la recepcionista IA
  por un canal, la página de reservas, o alguien del equipo).
- La recepcionista IA puede estar activa o pausada; en «modo aprobación» retiene respuestas
  hasta que el dueño las aprueba.
- Un negocio tiene uno o varios profesionales, cada uno con horario y servicios propios.

## Capabilities and Constraints

- Stack fijo: Next.js 16, React 19, Tailwind 3.4, Supabase. No hay modo oscuro.
- Idioma: español. Miles con coma (1,780), nunca con punto.
- Instagram y Messenger funcionan en el motor pero el dueño aún no puede conectarlos solo:
  no se deben mostrar como disponibles en pantallas nuevas hasta que Meta apruebe los permisos.
- No existen todavía: cobros a clientes finales, analíticas avanzadas, multi-sucursal real,
  módulo de voz.
- Plan de precios en USD (Arranque, Negocio, Profesional, Multi-sede). ChatVenti paga a Meta
  y repercute el consumo al cliente.

## Brand Commitments

- Nombre: ChatVenti. Logotipo e icono en `public/brand/`: globo de chat con calendario y
  palomita, en violeta y verde vivos; palabra en morado profundo, redonda y amable.
- Violeta de marca `#5b4fe0` (el de la landing).
- Voz: cercana, directa, en español de México; nombra las cosas como las dice un dueño de
  negocio («cita», «hueco», «no llegó»), no como las llama el sistema.
- **Dirección visual que Juan fijó el 2026-10-02 para el Panel y la Agenda:** colorido, con
  presencia, profesional, dinámico, con movimiento, y práctico tanto en computadora como en
  celular. Rechazó cuatro propuestas sobrias de fondo claro con un solo acento.

## Evidence on Hand

- No hay clientes reales todavía: no se pueden citar testimonios, cifras de uso ni logotipos
  de clientes. Los testimonios de la landing son ilustrativos.
- Hay una organización de demostración («ChatVenti Demo») con datos de prueba.
- Capturas de la referencia que Juan estudió (CitaFlow) en `_Screen/`.

## Product Principles

1. La pantalla dice qué hacer ahora, no solo qué pasó.
2. Lo que la IA hizo por el negocio se muestra con hechos: a quién agendó, qué chat pasó.
3. Un dueño con el teléfono en una mano debe poder resolver lo urgente con el pulgar.
4. Nunca prometer en pantalla algo que el negocio todavía no puede activar.
