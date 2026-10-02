# DESIGN.md — ChatVenti, diseño «Líneas»

Sistema visual del panel (todo lo que vive bajo `/dashboard`). Elegido por Juan el 2026-10-02
entre cuatro propuestas; en código desde el 2026-10-03. El contexto de producto está en
`PRODUCT.md`. La página pública y las de acceso tienen su propio lenguaje y no se rigen por esto.

## La idea

**Cada profesional es una línea de color y su día es el recorrido, como el plano del Metro.
Las citas son estaciones.** El dueño de una estética no lee tablas: mira quién está ocupado,
cuándo, y dónde hay hueco. Un plano de transporte responde justo a eso de un vistazo.

El Panel contesta cuatro preguntas, en este orden y sin scroll en computadora para las dos primeras:

1. **¿Qué pasa ahora?** → «Próxima estación»: una franja por profesional, con la hora enorme.
2. **¿Qué me toca hacer?** → «Avisos» (amarillo): lo único que pide una acción.
3. **¿Cómo va el día?** → «El día en líneas»: el plano completo.
4. **¿Qué hizo la recepcionista por mí?** → tarjeta oscura con su bitácora y el dinero del mes.

## Color

| Papel | Valor | Uso |
|---|---|---|
| Tinta | `#2a1a5e` (`ink`) | Texto, bordes de botones secundarios, tarjeta de la recepcionista |
| Tinta 2 | `#584d84` (`ink-muted`) | Texto secundario. Nunca más claro que `#7d7996` sobre blanco |
| Fondo | `#f1f4fb` (`surface`) | Fondo de página |
| Regla | `#dde2f0` (`line`) | Divisores y rejilla horaria |
| Marca | `#5b4fe0` (`brand-500`) | Riel de navegación, botón primario, iconos |
| Aviso | `#ffcd2e` | **Solo** para lo que espera una acción: la tarjeta de Avisos, contadores y «Sin confirmar» |
| En curso | `#4ade80` | Punto vivo de «En curso» y recepcionista activa |
| Peligro | `#c5221f` | «No asistió» |

**Líneas** (un color por profesional, en orden; `LINE_COLORS` en `src/features/lineas/model.ts`):
`#e0007a` · `#0b5bd3` · `#007a45` · `#c2410c` · `#0e7490` · `#7c3aed` · `#a16207` · `#be123c`.
Todos aguantan texto blanco encima (≥ 4.5:1), porque se usan como fondo de franja.

Reglas:
- El color de una línea significa **una persona**, nunca un estado. El estado va en la forma de la estación.
- El amarillo es escaso a propósito. Si todo es aviso, nada lo es.
- Cada sección de la navegación tiene su ficha de color (naranja Panel, tinta Agenda, verde azulado Chats, mostaza Clientes): son señalética, no decoración; no se reutilizan en contenido.

## Estados de una estación

| Estado | Forma |
|---|---|
| Sin confirmar | Círculo hueco + tramo hueco (solo contorno) |
| Confirmada | Círculo relleno con aro blanco + tramo relleno |
| En curso | Círculo doble, más grande, con pulso |
| Atendida | Gris con palomita |
| No asistió | Círculo rojo con equis + tramo rayado |
| Hueco libre | Tramo punteado del color de la línea, con «+» para agendar |
| No disponible | Bloque rayado gris («Entra 10:00», «Sale 17:00») |

El estado se distingue por **forma además de color**: funciona para daltónicos y en una pantalla al sol.

## Tipografía

**Rubik** (400, 500, 600, 700), cargada solo en el panel (`--font-rubik`). Cifras tabulares en todo
lo que sea hora o conteo. Escala corta: título de página 28 px/700, título de tarjeta 18 px/700,
cuerpo 15 px, apoyo 13 px. La hora de «Próxima estación» es el único texto gigante (42–51 px).

## Forma y espacio

- Tarjetas: radio 20 px, blanco, sombra muy corta (`0 1px 0 #dde2f0, 0 10px 26px -14px rgba(42,26,94,.22)`). Sin bordes grises.
- Botones: radio 13 px, alto mínimo 44 px al tacto y 40 px con ratón. Primario relleno de marca; secundario blanco con borde de tinta de 2 px.
- Chips de estado: 21 px de alto, radio completo.
- Nada de tarjetas dentro de tarjetas, salvo las filas blancas dentro de Avisos.

## Movimiento

- Entrada de las franjas escalonada (70 ms entre una y otra), una sola vez.
- El «tren» de cada franja avanza con el tiempo real de la cita.
- Pulso suave en la estación en curso; parpadeo en el punto de «En curso».
- Solo se animan `transform` y `opacity`. Todo se apaga con `prefers-reduced-motion`.

## Celular

No es el escritorio encogido: es otra disposición.
- La navegación baja a una barra violeta fija; «Más» abre una hoja inferior.
- El plano horizontal se convierte en una **lista vertical de estaciones** sobre su línea, con la marca de «ahora» intercalada.
- En la Agenda, cada profesional es un bloque; los huecos llevan su botón «+ Agendar» a todo lo ancho.

## Dónde vive

| Pieza | Archivo |
|---|---|
| Modelo del día (estaciones, huecos, ventanas) | `src/features/lineas/model.ts` |
| Plano y leyenda | `src/features/lineas/components/lines-diagram.tsx` |
| Franjas, avisos y tarjeta de la recepcionista | `src/features/lineas/components/panel-cards.tsx` |
| Trazado, patrones y animaciones | `src/features/lineas/lineas.css` |
| Datos del Panel | `src/features/lineas/panel-data.ts` |
| Navegación | `src/shared/components/dashboard-nav.tsx` |
| Tokens | `tailwind.config.ts` |

El día se arma **en el servidor** (`buildDay`): si lo calculara el navegador, «ahora» sería otro
instante y el HTML no coincidiría.

## Límites conocidos

- Con seis o más profesionales el plano horizontal se aprieta: usar el filtro por línea de la Agenda.
- Una persona con horario partido se dibuja como una sola ventana (de su primera entrada a su última salida).
- El resto de las pantallas (Chats, Clientes, Profesionales, Facturación…) heredan la tinta, el fondo, la tipografía y la navegación, pero conservan su disposición anterior. Rediseñarlas es trabajo aparte.
