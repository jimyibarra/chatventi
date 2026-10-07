import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { brandForHost } from '@/features/marca/brand'

// Manifest de la PWA según el dominio: ChatVenti en www.chatventi.com; la marca
// del socio en su dominio (agenda.pasen.mx).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await brandForHost((await headers()).get('host'))
  if (brand.partnerId) {
    return {
      name: brand.name,
      short_name: brand.name,
      description: brand.tagline,
      start_url: '/dashboard',
      display: 'standalone',
      background_color: '#f1f4fb',
      theme_color: brand.primaryColor,
      lang: 'es',
      icons: [{ src: brand.iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' }],
    }
  }
  return {
    name: 'ChatVenti',
    short_name: 'ChatVenti',
    description: 'Agenda + recepcionista IA para tu negocio, por WhatsApp, Telegram y web.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#5b4fe0',
    lang: 'es',
    icons: [
      { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
      { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
      { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
