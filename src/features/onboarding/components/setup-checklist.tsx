import Link from 'next/link'
import type { SetupChecklist } from '../checklist'
import { QuickSetupButton } from './quick-setup-button'
import { Section } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'

// Pasos que "Déjamelo listo" resuelve solo. Conectar WhatsApp y la primera
// cita no entran: el primero exige que el dueño inicie sesión en Meta.
const AUTO_KEYS = new Set(['service', 'hours', 'availability', 'agent'])

// Checklist de onboarding con % (patrón CitaFlow), dibujado como una línea
// del Metro: cada paso es una estación, rellena si ya está hecha y hueca si
// falta. Al 100% se colapsa a una sola línea de celebración.
export function SetupChecklistCard({ checklist }: { checklist: SetupChecklist }) {
  const { items, done, total, percent } = checklist

  if (percent === 100) {
    return (
      <Notice tone="success" testId="checklist-complete">
        Tu negocio está completamente configurado.
      </Notice>
    )
  }

  return (
    <Section
      data-testid="checklist"
      title="Pon tu negocio a punto"
      badge={
        <span className="text-[15px] font-bold tabular-nums text-brand-600" data-testid="checklist-percent">
          {percent}%
        </span>
      }
      description={`${done} de ${total} pasos completados`}
    >
      <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden>
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.max(percent, 4)}%` }}
        />
      </div>
      {items.some((i) => !i.done && AUTO_KEYS.has(i.key)) && <QuickSetupButton />}
      <ol className="relative">
        {/* La vía: une las estaciones de arriba abajo. */}
        <i className="absolute bottom-5 left-[13px] top-5 w-1 rounded bg-brand-200" aria-hidden />
        {items.map((item) =>
          item.done ? (
            <li key={item.key} className="relative flex min-h-[44px] items-center gap-3 py-1.5">
              <span className="relative z-[1] grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-brand-500 text-white shadow-[inset_0_0_0_3px_#fff,0_0_0_2px_#5b4fe0]" aria-hidden>
                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.2} />
              </span>
              <span className="text-[14.5px] text-ink-muted line-through decoration-ink-faint">{item.label}</span>
              <span className="sr-only">(hecho)</span>
            </li>
          ) : (
            <li key={item.key} className="relative">
              <Link
                href={item.href}
                data-testid={`checklist-${item.key}`}
                className="group -mx-2 flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors duration-150 hover:bg-brand-50"
              >
                <span className="relative z-[1] h-[30px] w-[30px] flex-none rounded-full border-[3.5px] border-brand-500 bg-white" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink group-hover:text-brand-700">{item.label}</span>
                  <span className="block text-[13.5px] leading-snug text-ink-muted">{item.hint}</span>
                </span>
                <Icon name="chevronRight" className="h-5 w-5 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </li>
          )
        )}
      </ol>
    </Section>
  )
}
