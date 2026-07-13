import Link from 'next/link'
import type { SetupChecklist } from '../checklist'

// Checklist de onboarding con % (patrón CitaFlow). Al 100% se colapsa a una
// sola línea de celebración; mientras, cada pendiente enlaza a su pantalla.
export function SetupChecklistCard({ checklist }: { checklist: SetupChecklist }) {
  const { items, done, total, percent } = checklist

  if (percent === 100) {
    return (
      <div
        className="mt-4 rounded-card border border-success-bg bg-success-bg p-4 text-sm font-medium text-success"
        data-testid="checklist-complete"
      >
        🎉 Tu negocio está completamente configurado.
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-card border border-line bg-white p-6" data-testid="checklist">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-bold text-ink">Pon tu negocio a punto</p>
        <span className="text-sm font-semibold text-ink-soft" data-testid="checklist-percent">
          {percent}%
        </span>
      </div>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${Math.max(percent, 4)}%` }}
        />
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        {done} de {total} pasos completados
      </p>
      <ul className="space-y-2">
        {items.map((item) =>
          item.done ? (
            <li key={item.key} className="flex items-center gap-2 text-sm text-ink-faint">
              <span aria-hidden>✅</span>
              <span className="line-through">{item.label}</span>
            </li>
          ) : (
            <li key={item.key}>
              <Link
                href={item.href}
                data-testid={`checklist-${item.key}`}
                className="group flex items-start gap-2 rounded-xl border border-line px-3 py-2 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span aria-hidden className="mt-0.5">
                  ⭕
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink group-hover:text-brand-700">
                    {item.label}
                  </span>
                  <span className="block text-xs text-ink-soft">{item.hint}</span>
                </span>
              </Link>
            </li>
          )
        )}
      </ul>
    </div>
  )
}
