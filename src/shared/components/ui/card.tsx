type CardProps = {
  children: React.ReactNode
  className?: string
  /** Realza la card al pasar el mouse (para cards clicables/interactivas). */
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line bg-white ${
        hover ? 'transition-all hover:border-brand-200 hover:shadow-card-hover' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
