import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// =====================================================================
// Fetch blindado contra SSRF.
//
//   La URL la escribe el usuario y la petición sale de NUESTRO servidor, que
//   vive dentro de una red privada y junto al endpoint de metadatos del
//   proveedor de nube. Sin estas comprobaciones, "analiza mi sitio web" es un
//   proxy para leer http://169.254.169.254/ (credenciales de la instancia),
//   servicios internos, o localhost.
//
//   🔴 Se valida la IP RESUELTA, no la cadena del host. `midominio.com` puede
//   resolver perfectamente a 127.0.0.1, y una lista negra de nombres no
//   detecta nada. Y se revalida en CADA salto de redirección: el primer host
//   puede ser público y el segundo interno (rebinding por redirección).
// =====================================================================

export type SafeFetchError =
  | 'esquema'      // no es http/https
  | 'host'         // host inválido o no resuelve
  | 'privada'      // resuelve a una IP no pública
  | 'redirecciones'// demasiados saltos
  | 'tamano'       // respuesta demasiado grande
  | 'tipo'         // no es HTML/texto
  | 'timeout'
  | 'red'

export type SafeFetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; error: SafeFetchError }

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8000
/** Tope de descarga. Una home legítima no pasa de unos cientos de KB. */
const MAX_BYTES = 1_500_000

/** ¿Esta IP es enrutable en internet? Todo lo demás se rechaza. */
function isPublicIp(ip: string): boolean {
  const v = isIP(ip)

  if (v === 4) {
    const p = ip.split('.').map(Number)
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false
    const [a, b] = p
    if (a === 0) return false                       // 0.0.0.0/8
    if (a === 10) return false                      // 10/8 privada
    if (a === 127) return false                     // loopback
    if (a === 169 && b === 254) return false        // link-local + metadatos de nube
    if (a === 172 && b >= 16 && b <= 31) return false // 172.16/12 privada
    if (a === 192 && b === 168) return false        // 192.168/16 privada
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT 100.64/10
    if (a === 192 && b === 0) return false          // 192.0.0/24 y 192.0.2/24
    if (a >= 224) return false                      // multicast y reservadas
    return true
  }

  if (v === 6) {
    // 🔴 NO comparar la cadena: `new URL()` NORMALIZA las IPv6, así que
    // `[::ffff:127.0.0.1]` llega aquí como `::ffff:7f00:1`. Una comprobación
    // por texto de `::ffff:` + IPv4 con puntos no lo reconoce y deja pasar
    // loopback. Hay que expandir la dirección a sus 8 grupos y mirar los bits.
    const g = ipv6Groups(ip.toLowerCase().split('%')[0])
    if (!g) return false

    const first7Zero = g.slice(0, 7).every((n) => n === 0)
    if (first7Zero && g[7] === 1) return false // ::1 loopback
    if (g.every((n) => n === 0)) return false  // :: sin especificar

    if ((g[0] & 0xffc0) === 0xfe80) return false // fe80::/10 link-local
    if ((g[0] & 0xfe00) === 0xfc00) return false // fc00::/7 únicas locales

    // Direcciones que TRANSPORTAN una IPv4 en los últimos 32 bits: la parte
    // IPv4 manda. Cubre ::ffff:a.b.c.d (mapeada), ::a.b.c.d (compatible,
    // obsoleta) y 64:ff9b::/96 (NAT64).
    const embedsIpv4 =
      (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) ||
      (g.slice(0, 6).every((n) => n === 0) && (g[6] !== 0 || g[7] > 1)) ||
      (g[0] === 0x0064 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0))

    if (embedsIpv4) {
      const v4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff].join('.')
      return isPublicIp(v4)
    }

    return true
  }

  return false
}

/** Expande una IPv6 (con `::` y/o IPv4 embebida) a sus 8 grupos de 16 bits. */
function ipv6Groups(ip: string): number[] | null {
  let s = ip

  // Cola en notación IPv4 (`::ffff:127.0.0.1`) → dos grupos hexadecimales.
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4) {
    const p = v4[1].split('.').map(Number)
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
    s = s.slice(0, v4.index) + `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`
  }

  const halves = s.split('::')
  if (halves.length > 2) return null

  const head = halves[0] ? halves[0].split(':').filter((x) => x !== '') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':').filter((x) => x !== '') : []

  let groups: string[]
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail]
  } else {
    groups = head
  }

  if (groups.length !== 8) return null
  const nums = groups.map((x) => parseInt(x, 16))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
  return nums
}

/** Valida esquema + que TODAS las IPs del host sean públicas. */
async function assertPublicUrl(raw: string): Promise<SafeFetchError | null> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'host'
  }

  // Solo http/https. Corta file://, ftp://, gopher://, data: …
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'esquema'
  if (!url.hostname) return 'host'

  const literal = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(literal)) {
    return isPublicIp(literal) ? null : 'privada'
  }

  try {
    // all:true — un host puede resolver a varias IPs y basta UNA privada para
    // que sea un vector. Se exigen todas públicas.
    const addresses = await lookup(url.hostname, { all: true })
    if (!addresses.length) return 'host'
    if (!addresses.every((a) => isPublicIp(a.address))) return 'privada'
    return null
  } catch {
    return 'host'
  }
}

/**
 * Descarga una página pública. Sigue redirecciones a mano para poder
 * revalidar el destino en cada salto.
 */
export async function safeFetchHtml(rawUrl: string): Promise<SafeFetchResult> {
  let current = rawUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const bad = await assertPublicUrl(current)
    if (bad) return { ok: false, error: bad }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(current, {
        redirect: 'manual', // los saltos los damos nosotros, para revalidar
        signal: controller.signal,
        headers: {
          'User-Agent': 'ChatVenti-VoiceBot/1.0 (+https://www.chatventi.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
    } catch (e) {
      clearTimeout(timer)
      return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'timeout' : 'red' }
    }

    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer)
      const location = res.headers.get('location')
      if (!location) return { ok: false, error: 'red' }
      current = new URL(location, current).toString()
      continue // vuelve a validar el nuevo destino
    }

    if (!res.ok) {
      clearTimeout(timer)
      return { ok: false, error: 'red' }
    }

    const type = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      clearTimeout(timer)
      return { ok: false, error: 'tipo' }
    }

    // Content-Length puede mentir o faltar: se corta mientras se lee.
    const declared = Number(res.headers.get('content-length') ?? '0')
    if (declared > MAX_BYTES) {
      clearTimeout(timer)
      return { ok: false, error: 'tamano' }
    }

    try {
      const reader = res.body?.getReader()
      if (!reader) {
        clearTimeout(timer)
        return { ok: false, error: 'red' }
      }
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > MAX_BYTES) {
          await reader.cancel()
          clearTimeout(timer)
          return { ok: false, error: 'tamano' }
        }
        chunks.push(value)
      }
      clearTimeout(timer)

      const buf = new Uint8Array(total)
      let offset = 0
      for (const c of chunks) {
        buf.set(c, offset)
        offset += c.byteLength
      }
      return { ok: true, html: new TextDecoder('utf-8').decode(buf), finalUrl: current }
    } catch (e) {
      clearTimeout(timer)
      return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'timeout' : 'red' }
    }
  }

  return { ok: false, error: 'redirecciones' }
}

/** Texto visible de una página: fuera scripts, estilos y etiquetas. */
export function visibleText(html: string, maxChars = 6000): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}
