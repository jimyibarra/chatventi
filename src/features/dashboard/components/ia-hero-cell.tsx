import Link from 'next/link'
import type { PanelMetrics } from '../metrics'

// Celda hero del bento: vende el trabajo de la IA del día. Único bloque con
// gradiente violeta del Panel (momento premium de la tarjeta aprobada).
export function IaHeroCell({ ia }: { ia: PanelMetrics['ia'] }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-card bg-gradient-to-br from-brand-500 to-brand-800 p-5 text-white">
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
        <span
          className={`h-[7px] w-[7px] rounded-full ${
            ia.enabled ? 'animate-pulse bg-emerald-300' : 'bg-white/50'
          }`}
        />
        {ia.enabled ? 'Recepcionista IA activa' : 'Recepcionista IA desactivada'}
      </span>

      {ia.enabled || ia.respondidas > 0 ? (
        <>
          <h2 className="mt-3.5 text-lg font-bold">
            Tu IA atendió {ia.respondidas} {ia.respondidas === 1 ? 'mensaje' : 'mensajes'} hoy
          </h2>
          <p className="mt-1 text-[12.5px] text-white/75">
            Mientras trabajabas, agendó y respondió por ti.
          </p>
          <div className="mt-auto flex gap-2.5 pt-4">
            <div className="flex-1 rounded-[13px] bg-white/15 px-2 py-3 text-center">
              <span className="block text-xl font-extrabold tabular-nums">{ia.agendadas}</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-wide text-white/75">
                agendadas
              </span>
            </div>
            <div className="flex-1 rounded-[13px] bg-white/15 px-2 py-3 text-center">
              <span className="block text-xl font-extrabold tabular-nums">{ia.escaladas}</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-wide text-white/75">
                escaladas
              </span>
            </div>
            <div className="flex-1 rounded-[13px] bg-white/15 px-2 py-3 text-center">
              <span className="block text-xl font-extrabold tabular-nums">{ia.respondidas}</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-wide text-white/75">
                respondidas
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-3.5 text-lg font-bold">Activa tu recepcionista IA</h2>
          <p className="mt-1 text-[12.5px] text-white/75">
            Responde a tus clientes y agenda citas por ti, 24/7, en WhatsApp y Telegram.
          </p>
          <div className="mt-auto pt-4">
            <Link
              href="/dashboard/agente"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-all hover:bg-brand-50"
            >
              Activar ahora
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
