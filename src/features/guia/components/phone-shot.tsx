// Captura REAL de una pantalla, dentro de un marco (teléfono o pantalla), con un
// aro amarillo que marca dónde tocar. Las coordenadas del aro van en % de la imagen.

export type Tap = { left: number; top: number; width: number; height: number; label?: string }

export function PhoneShot({
  src,
  alt,
  width,
  height,
  tap,
  caption,
  frame = 'phone',
  maxWidth,
}: {
  src: string
  alt: string
  width: number
  height: number
  tap?: Tap
  caption: string
  /** `phone`: captura de celular. `screen`: recorte de una pantalla de computadora. */
  frame?: 'phone' | 'screen'
  /** Ancho máximo en px (por defecto 272 el teléfono y 420 la pantalla). */
  maxWidth?: number
}) {
  const phone = frame === 'phone'
  return (
    <figure className="mx-auto w-full" style={{ maxWidth: maxWidth ?? (phone ? 272 : 420) }}>
      <div
        className={`relative overflow-hidden border-ink bg-white shadow-[0_18px_40px_-18px_rgba(42,26,94,.55)] ${
          phone ? 'rounded-[30px] border-[7px]' : 'rounded-[16px] border-[4px]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} loading="lazy" className="block h-auto w-full" />
        {tap && (
          <span
            className="guia-tap pointer-events-none absolute rounded-[10px] border-[3px] border-[#ffcd2e]"
            style={{ left: `${tap.left}%`, top: `${tap.top}%`, width: `${tap.width}%`, height: `${tap.height}%` }}
            aria-hidden
          >
            <span
              className={`absolute right-0 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-[#ffcd2e] ${
                tap.top < 12 ? '-bottom-[30px]' : '-top-[30px]'
              }`}
            >
              {tap.label ?? 'Toca aquí'}
            </span>
          </span>
        )}
      </div>
      <figcaption className="mt-2.5 text-center text-[13.5px] leading-snug text-ink-muted">{caption}</figcaption>
    </figure>
  )
}
