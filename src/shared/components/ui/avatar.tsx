/**
 * Inicial de una persona. Con `color` (el de su línea) es un profesional:
 * círculo relleno del color de su línea, como en el Panel. Sin color es un
 * cliente o un miembro del equipo: violeta claro, para no confundirlo con una línea.
 */
export function Avatar({
  name,
  src,
  color,
  size = 'md',
  className = '',
}: {
  name: string
  src?: string | null
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = size === 'lg' ? 'h-14 w-14 text-[22px]' : size === 'sm' ? 'h-8 w-8 text-[14px]' : 'h-10 w-10 text-[16px]'
  const initial = (name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase()
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${box} flex-none rounded-full object-cover ${color ? 'ring-[3px] ring-offset-2' : ''} ${className}`}
        style={color ? ({ '--tw-ring-color': color } as React.CSSProperties) : undefined}
      />
    )
  }
  return (
    <span
      className={`${box} grid flex-none place-items-center rounded-full font-bold leading-none ${color ? 'text-white' : 'bg-brand-50 text-brand-700'} ${className}`}
      style={color ? { background: color } : undefined}
      aria-hidden
    >
      {initial}
    </span>
  )
}
