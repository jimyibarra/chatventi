// =====================================================================
// Topes de la capa antiabuso, en un solo sitio.
//
// Criterio con el que están calibrados: un negocio REAL nunca debe tocarlos.
// El coste de un falso positivo (un cliente que no puede registrarse) es
// mucho mayor que el de un abusador que tarda un poco más en cansarse.
// =====================================================================

/** Altas permitidas desde una misma IP. Un local con varios empleados puede
 *  registrar más de una cuenta legítima; por eso no es 1. */
export const SIGNUP_MAX_PER_IP_PER_HOUR = 3
export const SIGNUP_MAX_PER_IP_PER_DAY = 6

/** Reintentos de alta con el MISMO correo canónico (frena el machaque). */
export const SIGNUP_MAX_PER_EMAIL_PER_HOUR = 5

/** Mensajes de IA que una organización puede consumir durante la prueba
 *  gratis. Un negocio activo ronda 80-150 en 10 días. */
export const TRIAL_AI_MESSAGE_CAP = 300

/** Sandbox "Prueba el Chat IA" — por ORGANIZACIÓN y día.
 *  Antes eran 25 por hilo, y el botón "Reiniciar conversación" borraba el
 *  hilo: es decir, no había tope. */
export const SANDBOX_MAX_PER_ORG_PER_DAY = 40

/** Demo pública de la landing — por IP y hora. */
export const DEMO_MAX_PER_IP_PER_HOUR = 30

/** Ventanas en segundos, para no repetir multiplicaciones por ahí. */
export const ONE_HOUR_SECONDS = 60 * 60
export const ONE_DAY_SECONDS = 24 * 60 * 60
