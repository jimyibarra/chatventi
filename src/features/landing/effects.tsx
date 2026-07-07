'use client'

import { useEffect } from 'react'

/**
 * Efectos de la landing (portados del script del diseño de Claude Design):
 *  - Scroll reveal sobre [data-reveal]: los elementos son visibles por defecto
 *    (SEO/no-JS); el JS los oculta y los revela al entrar al viewport.
 *  - Mockup de chat [data-chat-msg]: aparición escalonada de mensajes.
 * Respeta prefers-reduced-motion. No renderiza nada.
 */
export function LandingEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    reveals.forEach((el) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(24px)'
      el.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
    })
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
            io.unobserve(el)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    reveals.forEach((el) => io.observe(el))

    const msgs = Array.from(document.querySelectorAll<HTMLElement>('[data-chat-msg]'))
    const timers: ReturnType<typeof setTimeout>[] = []
    msgs.forEach((el) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(14px) scale(0.97)'
      el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
    })
    msgs.forEach((el, i) => {
      timers.push(
        setTimeout(() => {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0) scale(1)'
        }, 600 + i * 900)
      )
    })

    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [])

  return null
}
