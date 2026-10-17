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
  // 17-oct-2026: giros de ¡Pasen! (mismos 4 servicios típicos que siembra su página).
  restaurante: [
    { name: 'Desayunos', minutes: 30 },
    { name: 'Comida del día', minutes: 30 },
    { name: 'Jugos y licuados', minutes: 15 },
    { name: 'Ensaladas y cocteles de fruta', minutes: 15 },
  ],
  gimnasio: [
    { name: 'Clase de prueba', minutes: 60 },
    { name: 'Clases grupales', minutes: 60 },
    { name: 'Entrenamiento personal', minutes: 60 },
    { name: 'Valoración física', minutes: 30 },
  ],
  yoga_pilates: [
    { name: 'Clase de prueba', minutes: 60 },
    { name: 'Clase de yoga', minutes: 60 },
    { name: 'Clase de pilates', minutes: 60 },
    { name: 'Clase privada', minutes: 60 },
  ],
  taller_mecanico: [
    { name: 'Diagnóstico', minutes: 60 },
    { name: 'Afinación', minutes: 120 },
    { name: 'Cambio de aceite', minutes: 45 },
    { name: 'Revisión de frenos', minutes: 90 },
  ],
  despacho_contable: [
    { name: 'Asesoría inicial', minutes: 30 },
    { name: 'Declaración anual', minutes: 60 },
    { name: 'Contabilidad mensual', minutes: 60 },
    { name: 'Trámites ante el SAT', minutes: 45 },
  ],
  despacho_juridico: [
    { name: 'Consulta inicial', minutes: 45 },
    { name: 'Asesoría legal', minutes: 60 },
    { name: 'Revisión de contratos', minutes: 60 },
    { name: 'Trámites y gestiones', minutes: 45 },
  ],
  nutricion: [
    { name: 'Primera consulta', minutes: 60 },
    { name: 'Consulta de seguimiento', minutes: 30 },
    { name: 'Plan de alimentación', minutes: 45 },
    { name: 'Medición de composición corporal', minutes: 20 },
  ],
  psicologia: [
    { name: 'Primera sesión', minutes: 50 },
    { name: 'Terapia individual', minutes: 50 },
    { name: 'Terapia de pareja', minutes: 60 },
    { name: 'Terapia en línea', minutes: 50 },
  ],
  dermatologia: [
    { name: 'Consulta dermatológica', minutes: 30 },
    { name: 'Valoración estética', minutes: 30 },
    { name: 'Limpieza facial profunda', minutes: 60 },
    { name: 'Tratamiento láser', minutes: 45 },
  ],
  generico: [
    { name: 'Cita', minutes: 30 },
    { name: 'Cita larga', minutes: 60 },
  ],
}

// Lunes a sábado de 9:00 a 19:00; domingo cerrado. weekday 0 = domingo.
export const STARTER_HOURS = { open: '09:00', close: '19:00', closedWeekdays: [0] }
