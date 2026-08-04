import type { Metadata } from 'next'
import { LEGAL } from '@/shared/constants/legal'

// =====================================================================
// Helper de metadata por página.
//
// 🔴 POR QUÉ EXISTE: Next.js NO hace deep-merge de `openGraph` ni de
// `twitter`. Si una página declara `openGraph: { title }`, REEMPLAZA entero
// el objeto del layout — se pierden `type`, `siteName`, `locale`, y
// `twitter.card` cae al default `summary` (imagen pequeña) sin ningún aviso.
// Se detectó en la home mirando el HTML servido; ni typecheck ni build lo cazan.
//
// Toda página pública debe construir su metadata con este helper.
// =====================================================================

export function pageMetadata(opts: {
  /** Título completo, ya con marca si toca. Se emite tal cual (sin el template "· ChatVenti"). */
  title: string
  description: string
  /** Ruta absoluta desde la raíz, con barra inicial: '/', '/para/barberia'. */
  path: string
}): Metadata {
  const url = new URL(opts.path, LEGAL.siteUrl).toString()

  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: 'website',
      siteName: LEGAL.brand,
      locale: 'es_MX',
      url,
      title: opts.title,
      description: opts.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
    },
  }
}
