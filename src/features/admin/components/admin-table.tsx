import type { ReactNode } from 'react'
import { Card } from '@/shared/components/ui/card'

// Tablas del super admin: herramienta interna, densa pero legible. En celular
// se deslizan de lado y la primera columna (el negocio) queda fija a la vista.

/** Contenedor: tarjeta «Líneas» con la tabla desplazable dentro. */
export function AdminTable({ label, minWidth, children }: { label: string; minWidth: number; children: ReactNode }) {
  return (
    <Card padded={false} className="overflow-hidden">
      {/* Región desplazable enfocable: sin tabIndex no se puede recorrer con teclado.
          `relative`: sin él, un texto sr-only (posición absoluta) de la tabla se
          posiciona contra la página, escapa del recorte y la ensancha en celular. */}
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="relative overflow-x-auto focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-brand-500"
      >
        <table className="w-full border-collapse text-left text-[14px] text-ink" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </Card>
  )
}

/** Celda de cabecera. */
export const TH = 'whitespace-nowrap bg-white px-4 pb-2.5 pt-3.5 text-[12.5px] font-semibold text-ink-muted first:pl-5 last:pr-5'
/** Fila del cuerpo: regla fina arriba y realce al pasar el ratón. */
export const TR = 'group border-t border-line-row'
/** Celda del cuerpo. El fondo es explícito para que la columna fija no se transparente. */
export const TD =
  'bg-white px-4 py-3 align-middle transition-colors duration-150 first:pl-5 last:pr-5 group-hover:bg-[#f7f8fd] motion-reduce:transition-none'
/** Primera columna (el negocio): fija a la izquierda al deslizar la tabla. */
export const STICKY = 'sticky left-0 z-[1] shadow-[1px_0_0_#edf0f8]'
/** Cifras alineadas a la derecha con números tabulares. */
export const NUM = 'text-right tabular-nums'
