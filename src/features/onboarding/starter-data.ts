// Datos de arranque por giro para "te lo dejamos funcionando".
// Archivo APARTE de quick-setup.ts: un módulo 'use server' solo puede exportar
// funciones async, y estas constantes las importa también el servidor de páginas.
//
// Son un PUNTO DE PARTIDA editable: servicios típicos con su duración habitual.
// Sin precio a propósito: la recepcionista no inventa precios; mientras el dueño
// no los cargue, dice que se confirman en el negocio.

export type StarterService = { name: string; minutes: number }

export const STARTER_SERVICES: Record<string, StarterService[]> = {
  barberia_estetica: [
    { name: 'Corte de cabello', minutes: 30 },
    { name: 'Corte y barba', minutes: 45 },
    { name: 'Arreglo de barba', minutes: 20 },
    { name: 'Tinte', minutes: 90 },
  ],
  dental: [
    { name: 'Primera consulta y valoración', minutes: 30 },
    { name: 'Limpieza dental', minutes: 45 },
    { name: 'Resina (empaste)', minutes: 60 },
    { name: 'Urgencia dental', minutes: 30 },
  ],
  veterinaria: [
    { name: 'Consulta general', minutes: 30 },
    { name: 'Vacunación', minutes: 20 },
    { name: 'Baño y corte', minutes: 60 },
    { name: 'Desparasitación', minutes: 15 },
  ],
  spa_unas: [
    { name: 'Manicure', minutes: 45 },
    { name: 'Pedicure', minutes: 60 },
    { name: 'Uñas de gel', minutes: 90 },
    { name: 'Masaje relajante', minutes: 60 },
  ],
  medico: [
    { name: 'Consulta de primera vez', minutes: 40 },
    { name: 'Consulta de seguimiento', minutes: 20 },
  ],
  generico: [
    { name: 'Cita', minutes: 30 },
    { name: 'Cita larga', minutes: 60 },
  ],
}

// Lunes a sábado de 9:00 a 19:00; domingo cerrado. weekday 0 = domingo.
export const STARTER_HOURS = { open: '09:00', close: '19:00', closedWeekdays: [0] }
